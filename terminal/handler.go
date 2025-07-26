package terminal

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
}

type Session struct {
	conn      *websocket.Conn
	pty       *PTY
	ctx       context.Context
	cancel    context.CancelFunc
	writeMu   sync.Mutex
	closeOnce sync.Once
}

type Handler struct {
	sessions sync.Map
	mu       sync.RWMutex
}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	session := h.createSession(conn)
	h.sessions.Store(session, struct{}{})
	
	go session.handleConnection()
}

func (h *Handler) createSession(conn *websocket.Conn) *Session {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &Session{
		conn:   conn,
		ctx:    ctx,
		cancel: cancel,
	}
}

func (s *Session) handleConnection() {
	defer s.cleanup()
	
	conn := s.conn
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	go s.heartbeat(ticker)
	
	for {
		select {
		case <-s.ctx.Done():
			return
		default:
			_, data, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket error: %v", err)
				}
				return
			}
			
			if err := s.handleMessage(data); err != nil {
				log.Printf("Message handling error: %v", err)
				s.sendError(fmt.Sprintf("Error: %v", err))
			}
		}
	}
}

func (s *Session) handleMessage(data []byte) error {
	msg, err := UnmarshalMessage(data)
	if err != nil {
		return fmt.Errorf("failed to unmarshal message: %w", err)
	}
	
	switch msg.Type {
	case MsgTypeData:
		return s.handleData(msg.Data)
	case MsgTypeResize:
		return s.handleResize(msg.Data)
	case MsgTypeControl:
		return s.handleControl(msg.Data)
	case MsgTypeHeartbeat:
		return nil
	case MsgTypeClose:
		s.cancel()
		return nil
	default:
		return fmt.Errorf("unknown message type: %d", msg.Type)
	}
}

func (s *Session) handleData(data []byte) error {
	if s.pty == nil {
		pty, err := NewPTY(80, 24)
		if err != nil {
			return fmt.Errorf("failed to create PTY: %w", err)
		}
		s.pty = pty
		go s.readFromPTY()
	}
	
	_, err := s.pty.Write(data)
	return err
}

func (s *Session) handleResize(data []byte) error {
	if s.pty == nil {
		pty, err := NewPTY(80, 24)
		if err != nil {
			return fmt.Errorf("failed to create PTY: %w", err)
		}
		s.pty = pty
		go s.readFromPTY()
	}
	
	resizeData, err := UnmarshalResizeData(data)
	if err != nil {
		return fmt.Errorf("failed to unmarshal resize data: %w", err)
	}
	
	return s.pty.Resize(resizeData.Cols, resizeData.Rows)
}

func (s *Session) handleControl(data []byte) error {
	if s.pty == nil {
		return fmt.Errorf("no PTY available")
	}
	
	if len(data) < 1 {
		return fmt.Errorf("invalid control data")
	}
	
	signal := syscall.Signal(data[0])
	return s.pty.SendSignal(signal)
}

func (s *Session) readFromPTY() {
	if s.pty == nil {
		return
	}
	
	buffer := make([]byte, 4096)
	
	for {
		select {
		case <-s.ctx.Done():
			return
		default:
			n, err := s.pty.Read(buffer)
			if err != nil {
				if err.Error() != "EOF" {
					s.sendError(fmt.Sprintf("PTY read error: %v", err))
				}
				return
			}
			
			if n > 0 {
				s.sendData(buffer[:n])
			}
		}
	}
}

func (s *Session) sendData(data []byte) {
	msg := &Message{
		Type: MsgTypeData,
		Data: data,
	}
	s.sendMessage(msg)
}

func (s *Session) sendError(errMsg string) {
	msg := &Message{
		Type: MsgTypeError,
		Data: []byte(errMsg),
	}
	s.sendMessage(msg)
}

func (s *Session) sendMessage(msg *Message) {
	data, err := msg.Marshal()
	if err != nil {
		log.Printf("Failed to marshal message: %v", err)
		return
	}
	
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	
	s.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	if err := s.conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
		log.Printf("Failed to write message: %v", err)
		s.cancel()
	}
}

func (s *Session) heartbeat(ticker *time.Ticker) {
	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.writeMu.Lock()
			s.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := s.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				s.writeMu.Unlock()
				s.cancel()
				return
			}
			s.writeMu.Unlock()
		}
	}
}

func (s *Session) cleanup() {
	s.closeOnce.Do(func() {
		s.cancel()
		
		if s.pty != nil {
			s.pty.Close()
		}
		
		s.conn.Close()
	})
}
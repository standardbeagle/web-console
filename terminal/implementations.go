package terminal

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"sync"
	"syscall"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
)

// Concrete implementations of interfaces

// DefaultPTYProvider implements PTYProvider
type DefaultPTYProvider struct{}

func NewDefaultPTYProvider() *DefaultPTYProvider {
	return &DefaultPTYProvider{}
}

func (p *DefaultPTYProvider) CreatePTY(ctx context.Context, cols, rows uint16) (PTYSession, error) {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "cmd.exe")
	} else {
		shell := os.Getenv("SHELL")
		if shell == "" {
			shell = "/bin/bash"
		}
		cmd = exec.CommandContext(ctx, shell)
	}
	
	cmd.Env = os.Environ()
	
	ptyFile, err := pty.StartWithSize(cmd, &pty.Winsize{
		Rows: rows,
		Cols: cols,
	})
	if err != nil {
		return nil, err
	}
	
	return &DefaultPTYSession{
		cmd: cmd,
		pty: ptyFile,
	}, nil
}

// DefaultPTYSession implements PTYSession
type DefaultPTYSession struct {
	cmd    *exec.Cmd
	pty    *os.File
	mu     sync.RWMutex
	closed bool
}

func (s *DefaultPTYSession) Read(buf []byte) (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if s.closed {
		return 0, fmt.Errorf("session closed")
	}
	
	return s.pty.Read(buf)
}

func (s *DefaultPTYSession) Write(data []byte) (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if s.closed {
		return 0, fmt.Errorf("session closed")
	}
	
	return s.pty.Write(data)
}

func (s *DefaultPTYSession) Resize(cols, rows uint16) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if s.closed {
		return fmt.Errorf("session closed")
	}
	
	return pty.Setsize(s.pty, &pty.Winsize{
		Rows: rows,
		Cols: cols,
	})
}

func (s *DefaultPTYSession) SendSignal(sig syscall.Signal) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if s.closed || s.cmd.Process == nil {
		return fmt.Errorf("session closed")
	}
	
	if runtime.GOOS == "windows" {
		return s.cmd.Process.Kill()
	}
	
	return s.cmd.Process.Signal(sig)
}

func (s *DefaultPTYSession) Wait() error {
	if s.cmd == nil {
		return nil
	}
	return s.cmd.Wait()
}

func (s *DefaultPTYSession) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if s.closed {
		return nil
	}
	
	s.closed = true
	
	if s.pty != nil {
		s.pty.Close()
	}
	
	if s.cmd != nil && s.cmd.Process != nil {
		if runtime.GOOS == "windows" {
			s.cmd.Process.Kill()
		} else {
			s.cmd.Process.Signal(syscall.SIGTERM)
		}
	}
	
	return nil
}

// BinaryMessageEncoder implements MessageEncoder
type BinaryMessageEncoder struct{}

func NewBinaryMessageEncoder() *BinaryMessageEncoder {
	return &BinaryMessageEncoder{}
}

func (e *BinaryMessageEncoder) EncodeMessage(msgType MessageType, data []byte) ([]byte, error) {
	msg := &Message{
		Type: msgType,
		Data: data,
	}
	return msg.Marshal()
}

func (e *BinaryMessageEncoder) DecodeMessage(data []byte) (*Message, error) {
	return UnmarshalMessage(data)
}

// GorillaWebSocketConnection wraps gorilla websocket to implement WebSocketConnection
type GorillaWebSocketConnection struct {
	conn *websocket.Conn
}

func NewGorillaWebSocketConnection(conn *websocket.Conn) *GorillaWebSocketConnection {
	return &GorillaWebSocketConnection{conn: conn}
}

func (w *GorillaWebSocketConnection) ReadMessage() (messageType int, data []byte, err error) {
	return w.conn.ReadMessage()
}

func (w *GorillaWebSocketConnection) WriteMessage(messageType int, data []byte) error {
	return w.conn.WriteMessage(messageType, data)
}

func (w *GorillaWebSocketConnection) SetReadDeadline(deadline interface{}) error {
	// Type assertion would be needed here based on actual deadline type
	return nil
}

func (w *GorillaWebSocketConnection) SetWriteDeadline(deadline interface{}) error {
	// Type assertion would be needed here based on actual deadline type  
	return nil
}

func (w *GorillaWebSocketConnection) SetPongHandler(handler func(string) error) {
	w.conn.SetPongHandler(handler)
}

func (w *GorillaWebSocketConnection) Close() error {
	return w.conn.Close()
}

// InMemorySessionStore implements SessionStore
type InMemorySessionStore struct {
	sessions sync.Map
}

func NewInMemorySessionStore() *InMemorySessionStore {
	return &InMemorySessionStore{}
}

func (s *InMemorySessionStore) CreateSession(id string, session *Session) error {
	s.sessions.Store(id, session)
	return nil
}

func (s *InMemorySessionStore) GetSession(id string) (*Session, bool) {
	if val, ok := s.sessions.Load(id); ok {
		return val.(*Session), true
	}
	return nil, false
}

func (s *InMemorySessionStore) DeleteSession(id string) error {
	s.sessions.Delete(id)
	return nil
}

func (s *InMemorySessionStore) ListSessions() []*Session {
	var sessions []*Session
	s.sessions.Range(func(key, value interface{}) bool {
		sessions = append(sessions, value.(*Session))
		return true
	})
	return sessions
}
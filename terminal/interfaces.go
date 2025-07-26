package terminal

import (
	"context"
	"io"
	"syscall"
)

// Core interfaces for dependency injection and testability

type PTYProvider interface {
	CreatePTY(ctx context.Context, cols, rows uint16) (PTYSession, error)
}

type PTYSession interface {
	io.ReadWriter
	Resize(cols, rows uint16) error
	SendSignal(sig syscall.Signal) error
	Wait() error
	Close() error
}

type MessageEncoder interface {
	EncodeMessage(msgType MessageType, data []byte) ([]byte, error)
	DecodeMessage(data []byte) (*Message, error)
}

type ConnectionManager interface {
	HandleConnection(ctx context.Context, conn WebSocketConnection) error
	GetActiveConnections() int
	CloseAllConnections() error
}

type WebSocketConnection interface {
	ReadMessage() (messageType int, data []byte, err error)
	WriteMessage(messageType int, data []byte) error
	SetReadDeadline(deadline interface{}) error
	SetWriteDeadline(deadline interface{}) error
	SetPongHandler(handler func(string) error)
	Close() error
}

type EventBus interface {
	Subscribe(eventType string, handler EventHandler)
	Publish(eventType string, data interface{})
	Unsubscribe(eventType string, handler EventHandler)
}

type EventHandler func(data interface{})

type SessionStore interface {
	CreateSession(id string, session *Session) error
	GetSession(id string) (*Session, bool)
	DeleteSession(id string) error
	ListSessions() []*Session
}

// Configuration for dependency injection
type Config struct {
	PTYProvider       PTYProvider
	MessageEncoder    MessageEncoder
	ConnectionManager ConnectionManager
	EventBus          EventBus
	SessionStore      SessionStore
}
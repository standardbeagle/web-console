package terminal

import (
	"encoding/binary"
	"errors"
)

type MessageType uint8

const (
	MsgTypeData        MessageType = 0x01
	MsgTypeResize      MessageType = 0x02
	MsgTypeControl     MessageType = 0x03
	MsgTypeError       MessageType = 0x04
	MsgTypeHeartbeat   MessageType = 0x05
	MsgTypeClose       MessageType = 0x06
)

type Message struct {
	Type MessageType
	Data []byte
}

type ResizeData struct {
	Cols uint16
	Rows uint16
}

type ControlData struct {
	Signal uint8
}

func (m *Message) Marshal() ([]byte, error) {
	if len(m.Data) > 0xFFFF {
		return nil, errors.New("message data too large")
	}
	
	buf := make([]byte, 3+len(m.Data))
	buf[0] = uint8(m.Type)
	binary.LittleEndian.PutUint16(buf[1:3], uint16(len(m.Data)))
	copy(buf[3:], m.Data)
	
	return buf, nil
}

func UnmarshalMessage(data []byte) (*Message, error) {
	if len(data) < 3 {
		return nil, errors.New("message too short")
	}
	
	msgType := MessageType(data[0])
	dataLen := binary.LittleEndian.Uint16(data[1:3])
	
	if len(data) < int(3+dataLen) {
		return nil, errors.New("incomplete message")
	}
	
	return &Message{
		Type: msgType,
		Data: data[3:3+dataLen],
	}, nil
}

func (r *ResizeData) Marshal() []byte {
	buf := make([]byte, 4)
	binary.LittleEndian.PutUint16(buf[0:2], r.Cols)
	binary.LittleEndian.PutUint16(buf[2:4], r.Rows)
	return buf
}

func UnmarshalResizeData(data []byte) (*ResizeData, error) {
	if len(data) < 4 {
		return nil, errors.New("invalid resize data")
	}
	
	return &ResizeData{
		Cols: binary.LittleEndian.Uint16(data[0:2]),
		Rows: binary.LittleEndian.Uint16(data[2:4]),
	}, nil
}
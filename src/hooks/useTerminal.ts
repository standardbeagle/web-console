import { useCallback, useEffect, useRef, useState } from 'react';

export enum MessageType {
  DATA = 0x01,
  RESIZE = 0x02,
  CONTROL = 0x03,
  ERROR = 0x04,
  HEARTBEAT = 0x05,
  CLOSE = 0x06,
}

export interface TerminalMessage {
  type: MessageType;
  data: Uint8Array;
}

export interface ResizeData {
  cols: number;
  rows: number;
}

export interface TerminalHookOptions {
  url: string;
  onData?: (data: Uint8Array) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export interface TerminalConnection {
  isConnected: boolean;
  isConnecting: boolean;
  sendData: (data: string | Uint8Array) => void;
  resize: (cols: number, rows: number) => void;
  sendControl: (signal: number) => void;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

function encodeMessage(type: MessageType, data: Uint8Array): Uint8Array {
  const buffer = new ArrayBuffer(3 + data.length);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);
  
  view.setUint8(0, type);
  view.setUint16(1, data.length, true); // little endian
  uint8View.set(data, 3);
  
  return uint8View;
}

function decodeMessage(buffer: ArrayBuffer): TerminalMessage | null {
  if (buffer.byteLength < 3) {
    return null;
  }
  
  const view = new DataView(buffer);
  const type = view.getUint8(0) as MessageType;
  const dataLength = view.getUint16(1, true); // little endian
  
  if (buffer.byteLength < 3 + dataLength) {
    return null;
  }
  
  const data = new Uint8Array(buffer, 3, dataLength);
  
  return { type, data };
}

function encodeResizeData(cols: number, rows: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  
  view.setUint16(0, cols, true); // little endian
  view.setUint16(2, rows, true); // little endian
  
  return new Uint8Array(buffer);
}

export function useTerminal(options: TerminalHookOptions): TerminalConnection {
  const {
    url,
    onData,
    onError,
    onConnect,
    onDisconnect,
    reconnectAttempts = 5,
    reconnectInterval = 1000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnectRef = useRef(false);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      
      if (wsRef.current.readyState === WebSocket.OPEN) {
        const closeMsg = encodeMessage(MessageType.CLOSE, new Uint8Array());
        wsRef.current.send(closeMsg);
      }
      
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnecting) {
      return;
    }

    setIsConnecting(true);
    isManualDisconnectRef.current = false;

    try {
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        reconnectCountRef.current = 0;
        onConnect?.();
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        onDisconnect?.();

        if (!isManualDisconnectRef.current && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          const delay = reconnectInterval * Math.pow(1.5, reconnectCountRef.current - 1);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onmessage = (event) => {
        const message = decodeMessage(event.data);
        if (!message) {
          return;
        }

        switch (message.type) {
          case MessageType.DATA:
            onData?.(message.data);
            break;
          case MessageType.ERROR:
            const errorMsg = new TextDecoder().decode(message.data);
            onError?.(errorMsg);
            break;
          case MessageType.HEARTBEAT:
            break;
          default:
            break;
        }
      };

      ws.onerror = (event) => {
        setIsConnecting(false);
        onError?.('WebSocket connection error');
      };

    } catch (error) {
      setIsConnecting(false);
      onError?.(`Connection failed: ${error}`);
    }
  }, [url, onData, onError, onConnect, onDisconnect, reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    cleanup();
  }, [cleanup]);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      reconnectCountRef.current = 0;
      connect();
    }, 100);
  }, [disconnect, connect]);

  const sendData = useCallback((data: string | Uint8Array) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const dataBytes = typeof data === 'string' 
      ? new TextEncoder().encode(data)
      : data;
    
    const message = encodeMessage(MessageType.DATA, dataBytes);
    wsRef.current.send(message);
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const resizeData = encodeResizeData(cols, rows);
    const message = encodeMessage(MessageType.RESIZE, resizeData);
    wsRef.current.send(message);
  }, []);

  const sendControl = useCallback((signal: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const controlData = new Uint8Array([signal]);
    const message = encodeMessage(MessageType.CONTROL, controlData);
    wsRef.current.send(message);
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isConnected,
    isConnecting,
    sendData,
    resize,
    sendControl,
    connect,
    disconnect,
    reconnect,
  };
}
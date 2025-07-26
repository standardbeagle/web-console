import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { CanvasAddon } from '@xterm/addon-canvas';
import { useTerminal, TerminalHookOptions } from '../hooks/useTerminal';
import '@xterm/xterm/css/xterm.css';

export interface TerminalProps {
  url: string;
  className?: string;
  theme?: {
    background?: string;
    foreground?: string;
    cursor?: string;
    selection?: string;
    black?: string;
    red?: string;
    green?: string;
    yellow?: string;
    blue?: string;
    magenta?: string;
    cyan?: string;
    white?: string;
    brightBlack?: string;
    brightRed?: string;
    brightGreen?: string;
    brightYellow?: string;
    brightBlue?: string;
    brightMagenta?: string;
    brightCyan?: string;
    brightWhite?: string;
  };
  options?: {
    fontSize?: number;
    fontFamily?: string;
    lineHeight?: number;
    letterSpacing?: number;
    cursorBlink?: boolean;
    cursorStyle?: 'block' | 'underline' | 'bar';
    scrollback?: number;
    tabStopWidth?: number;
    allowTransparency?: boolean;
  };
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onResize?: (cols: number, rows: number) => void;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export const Terminal: React.FC<TerminalProps> = ({
  url,
  className = '',
  theme,
  options = {},
  onConnect,
  onDisconnect,
  onError,
  onResize,
  autoConnect = true,
  reconnectAttempts = 5,
  reconnectInterval = 1000,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const handleTerminalData = useCallback((data: Uint8Array) => {
    if (xtermRef.current) {
      const text = new TextDecoder().decode(data);
      xtermRef.current.write(text);
    }
  }, []);

  const handleError = useCallback((error: string) => {
    if (xtermRef.current) {
      xtermRef.current.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
    }
    onError?.(error);
  }, [onError]);

  const handleConnect = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.write('\r\n\x1b[32mConnected to terminal\x1b[0m\r\n');
    }
    onConnect?.();
  }, [onConnect]);

  const handleDisconnect = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.write('\r\n\x1b[33mDisconnected from terminal\x1b[0m\r\n');
    }
    onDisconnect?.();
  }, [onDisconnect]);

  const terminalOptions: TerminalHookOptions = {
    url,
    onData: handleTerminalData,
    onError: handleError,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    reconnectAttempts,
    reconnectInterval,
  };

  const {
    isConnected,
    isConnecting,
    sendData,
    resize,
    sendControl,
    connect,
    disconnect,
    reconnect,
  } = useTerminal(terminalOptions);

  const handleResize = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current) {
      fitAddonRef.current.fit();
      const cols = xtermRef.current.cols;
      const rows = xtermRef.current.rows;
      resize(cols, rows);
      onResize?.(cols, rows);
    }
  }, [resize, onResize]);

  const initializeTerminal = useCallback(() => {
    if (!terminalRef.current || isInitialized) {
      return;
    }

    const defaultTheme = {
      background: '#000000',
      foreground: '#ffffff',
      cursor: '#ffffff',
      selection: 'rgba(255, 255, 255, 0.3)',
      black: '#000000',
      red: '#cd0000',
      green: '#00cd00',
      yellow: '#cdcd00',
      blue: '#0000ee',
      magenta: '#cd00cd',
      cyan: '#00cdcd',
      white: '#faebd7',
      brightBlack: '#404040',
      brightRed: '#ff0000',
      brightGreen: '#00ff00',
      brightYellow: '#ffff00',
      brightBlue: '#5c5cff',
      brightMagenta: '#ff00ff',
      brightCyan: '#00ffff',
      brightWhite: '#ffffff',
    };

    const xterm = new XTerm({
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", "SF Mono", Monaco, "Inconsolata", "Roboto Mono", "Source Code Pro", Menlo, "DejaVu Sans Mono", monospace',
      lineHeight: 1.2,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 4,
      allowTransparency: false,
      theme: { ...defaultTheme, ...theme },
      ...options,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    const canvasAddon = new CanvasAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.loadAddon(searchAddon);
    xterm.loadAddon(canvasAddon);

    xterm.open(terminalRef.current);
    
    fitAddon.fit();

    xterm.onData((data) => {
      sendData(data);
    });

    xterm.onResize(({ cols, rows }) => {
      resize(cols, rows);
      onResize?.(cols, rows);
    });

    xterm.attachCustomKeyEventHandler((event) => {
      if (event.ctrlKey && event.key === 'c' && event.type === 'keydown') {
        sendControl(2); // SIGINT
        return false;
      }
      
      if (event.ctrlKey && event.key === 'z' && event.type === 'keydown') {
        sendControl(20); // SIGTSTP
        return false;
      }
      
      return true;
    });

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    resizeObserverRef.current = new ResizeObserver(handleResize);
    resizeObserverRef.current.observe(terminalRef.current);

    setIsInitialized(true);

    if (autoConnect) {
      connect();
    }
  }, [
    isInitialized,
    theme,
    options,
    sendData,
    resize,
    sendControl,
    onResize,
    autoConnect,
    connect,
    handleResize,
  ]);

  useEffect(() => {
    initializeTerminal();

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      
      fitAddonRef.current = null;
      setIsInitialized(false);
    };
  }, [initializeTerminal]);

  useEffect(() => {
    const handleWindowResize = () => {
      setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [handleResize]);

  const getStatusColor = () => {
    if (isConnecting) return '#ffa500';
    if (isConnected) return '#00ff00';
    return '#ff0000';
  };

  const getStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Connected';
    return 'Disconnected';
  };

  return (
    <div className={`terminal-container ${className}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div className="terminal-status" style={{
        position: 'absolute',
        top: '4px',
        right: '4px',
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: getStatusColor(),
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '10px',
        fontFamily: 'monospace',
      }}>
        ● {getStatusText()}
      </div>
      
      <div className="terminal-controls" style={{
        position: 'absolute',
        top: '4px',
        left: '4px',
        zIndex: 10,
        display: 'flex',
        gap: '4px',
      }}>
        {!isConnected && !isConnecting && (
          <button
            onClick={connect}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: '#00ff00',
              border: '1px solid #00ff00',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            Connect
          </button>
        )}
        
        {isConnected && (
          <button
            onClick={disconnect}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: '#ff0000',
              border: '1px solid #ff0000',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            Disconnect
          </button>
        )}
        
        <button
          onClick={reconnect}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#ffa500',
            border: '1px solid #ffa500',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
        >
          Reconnect
        </button>
      </div>
      
      <div
        ref={terminalRef}
        className="terminal"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      />
    </div>
  );
};
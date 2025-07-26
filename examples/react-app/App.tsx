import React, { useState, useCallback } from 'react';
import { Terminal } from '../src/components/Terminal';

const App: React.FC = () => {
  const [terminalUrl] = useState('ws://localhost:8080/ws/terminal');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(() => {
    setIsConnected(true);
    setError(null);
    console.log('Terminal connected');
  }, []);

  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    console.log('Terminal disconnected');
  }, []);

  const handleError = useCallback((error: string) => {
    setError(error);
    console.error('Terminal error:', error);
  }, []);

  const handleResize = useCallback((cols: number, rows: number) => {
    console.log(`Terminal resized to ${cols}x${rows}`);
  }, []);

  const terminalTheme = {
    background: '#1a1a1a',
    foreground: '#ffffff',
    cursor: '#ffffff',
    selection: 'rgba(255, 255, 255, 0.3)',
    black: '#000000',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#44475a',
    brightRed: '#ff5555',
    brightGreen: '#50fa7b',
    brightYellow: '#f1fa8c',
    brightBlue: '#bd93f9',
    brightMagenta: '#ff79c6',
    brightCyan: '#8be9fd',
    brightWhite: '#ffffff',
  };

  const terminalOptions = {
    fontSize: 14,
    fontFamily: '"Fira Code", "Cascadia Code", "SF Mono", Monaco, monospace',
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle: 'block' as const,
    scrollback: 1000,
    tabStopWidth: 4,
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <header style={{
        padding: '1rem',
        backgroundColor: '#2d2d2d',
        borderBottom: '1px solid #444',
        color: '#ffffff',
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Web Terminal</h1>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem', 
          marginTop: '0.5rem',
          fontSize: '0.9rem',
        }}>
          <span>Status: 
            <span style={{ 
              color: isConnected ? '#50fa7b' : '#ff5555',
              marginLeft: '0.5rem',
            }}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </span>
          
          <span>URL: 
            <code style={{ 
              backgroundColor: '#1a1a1a', 
              padding: '0.2rem 0.4rem', 
              borderRadius: '3px',
              marginLeft: '0.5rem',
            }}>
              {terminalUrl}
            </code>
          </span>
          
          {error && (
            <span style={{ color: '#ff5555' }}>
              Error: {error}
            </span>
          )}
        </div>
      </header>

      <main style={{ 
        flex: 1, 
        padding: '1rem',
        overflow: 'hidden',
      }}>
        <div style={{ 
          width: '100%', 
          height: '100%', 
          border: '1px solid #444',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <Terminal
            url={terminalUrl}
            theme={terminalTheme}
            options={terminalOptions}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onError={handleError}
            onResize={handleResize}
            autoConnect={true}
            reconnectAttempts={5}
            reconnectInterval={1000}
          />
        </div>
      </main>

      <footer style={{
        padding: '0.5rem 1rem',
        backgroundColor: '#2d2d2d',
        borderTop: '1px solid #444',
        color: '#888',
        fontSize: '0.8rem',
        textAlign: 'center',
      }}>
        High-performance terminal with binary WebSocket protocol
      </footer>
    </div>
  );
};

export default App;
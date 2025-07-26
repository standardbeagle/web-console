import React, { useState, useCallback } from 'react';
import { Terminal } from '@standardbeagle/web-console';

function App() {
  const [terminalUrl] = useState('ws://localhost:8080/ws/terminal');
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const handleConnect = useCallback(() => {
    setStatus('connected');
  }, []);

  const handleDisconnect = useCallback(() => {
    setStatus('disconnected');
  }, []);

  const handleError = useCallback((error: string) => {
    console.error('Terminal error:', error);
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1a1a1a',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '8px 16px',
        backgroundColor: '#2d2d2d',
        borderBottom: '1px solid #444',
        color: '#fff',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <span>Wails Terminal Example</span>
        <span style={{
          color: status === 'connected' ? '#4ade80' : 
                status === 'connecting' ? '#fbbf24' : '#f87171'
        }}>
          ● {status}
        </span>
      </div>
      
      <div style={{ flex: 1, padding: '8px' }}>
        <Terminal
          url={terminalUrl}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onError={handleError}
          theme={{
            background: '#1a1a1a',
            foreground: '#ffffff',
          }}
          options={{
            fontSize: 14,
            fontFamily: '"Cascadia Code", "Fira Code", monospace',
            cursorBlink: true,
          }}
          autoConnect={true}
        />
      </div>
    </div>
  );
}

export default App;
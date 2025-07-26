# @standardbeagle/web-console

A high-performance terminal component library with binary WebSocket communication, designed for Go + React applications and Wails desktop apps.

[![npm version](https://badge.fury.io/js/@standardbeagle%2Fweb-console.svg)](https://badge.fury.io/js/@standardbeagle%2Fweb-console)
[![Go Reference](https://pkg.go.dev/badge/github.com/standardbeagle/web-console.svg)](https://pkg.go.dev/github.com/standardbeagle/web-console)

## Features

- **Binary WebSocket Protocol**: Efficient binary message format for minimal overhead
- **Goroutine-based PTY Management**: Lock-free concurrent handling of terminal processes
- **React Integration**: Ready-to-use React hooks and components
- **Cross-platform Support**: Works on Windows, macOS, and Linux
- **Auto-reconnection**: Robust connection management with exponential backoff
- **Resource Management**: Proper cleanup and memory management
- **Customizable UI**: Themeable terminal with modern design

## Architecture

### Go Backend Components

- **Protocol (`terminal/protocol.go`)**: Binary message encoding/decoding
- **PTY Management (`terminal/pty.go`)**: Cross-platform pseudo-terminal handling
- **WebSocket Handler (`terminal/handler.go`)**: Goroutine-based connection management

### React Frontend Components

- **Hook (`src/hooks/useTerminal.ts`)**: WebSocket connection management
- **Component (`src/components/Terminal.tsx`)**: xterm.js integration with controls

## Quick Start

### 1. Install Dependencies

```bash
# Go dependencies
go mod tidy

# Node.js dependencies
npm install
```

### 2. For Go Applications

```go
import "github.com/standardbeagle/web-console/terminal"

func main() {
    handler := terminal.NewHandler()
    http.Handle("/ws/terminal", handler)
    http.ListenAndServe(":8080", nil)
}
```

### 3. For React Applications

```tsx
import { Terminal } from '@standardbeagle/web-console';

function App() {
  return (
    <Terminal
      url="ws://localhost:8080/ws/terminal"
      theme={{
        background: '#1a1a1a',
        foreground: '#ffffff',
      }}
      options={{
        fontSize: 14,
        fontFamily: '"Fira Code", monospace',
        cursorBlink: true,
      }}
      onConnect={() => console.log('Connected')}
      onError={(error) => console.error('Error:', error)}
    />
  );
}
```

### 4. For Wails Applications

**Go Backend:**
```go
import "github.com/standardbeagle/web-console/terminal"

func (a *App) OnStartup(ctx context.Context) {
    handler := terminal.NewHandler()
    mux := http.NewServeMux()
    mux.Handle("/ws/terminal", handler)
    go http.ListenAndServe(":8080", mux)
}
```

**React Frontend:**
```tsx
import { Terminal } from '@standardbeagle/web-console';

function App() {
    return <Terminal url="ws://localhost:8080/ws/terminal" />;
}
```

## Protocol Specification

The binary protocol uses a 3-byte header followed by payload data:

```
[Type:1][Length:2][Data:Length]
```

### Message Types

- `0x01` - Data (terminal input/output)
- `0x02` - Resize (terminal dimensions)
- `0x03` - Control (signals like Ctrl+C)
- `0x04` - Error (error messages)
- `0x05` - Heartbeat (keep-alive)
- `0x06` - Close (connection termination)

### Resize Message Format

```
[Cols:2][Rows:2] (little-endian uint16)
```

## API Reference

### Go Handler

```go
handler := terminal.NewHandler()
http.Handle("/ws/terminal", handler)
```

### React Hook

```typescript
const {
  isConnected,
  isConnecting,
  sendData,
  resize,
  sendControl,
  connect,
  disconnect,
  reconnect,
} = useTerminal({
  url: 'ws://localhost:8080/ws/terminal',
  onData: (data) => console.log('Received:', data),
  onError: (error) => console.error('Error:', error),
  reconnectAttempts: 5,
  reconnectInterval: 1000,
});
```

### Terminal Component Props

```typescript
interface TerminalProps {
  url: string;
  className?: string;
  theme?: TerminalTheme;
  options?: TerminalOptions;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onResize?: (cols: number, rows: number) => void;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}
```

## Performance Features

- **Lock-free Design**: Uses sync.Map and atomic operations instead of mutexes
- **Binary Protocol**: Minimal overhead compared to JSON/text protocols
- **Goroutine Pool**: Efficient concurrent handling of multiple connections
- **Memory Management**: Proper cleanup prevents memory leaks
- **Canvas Rendering**: Hardware-accelerated terminal rendering via WebGL

## Security Considerations

- Input validation on all message types
- Resource limits to prevent abuse
- Proper signal handling for process management
- Connection timeout and heartbeat mechanisms

## Browser Compatibility

- Chrome/Chromium 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## License

MIT License - see LICENSE file for details.
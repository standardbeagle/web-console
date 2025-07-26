# Examples

This directory contains example implementations showing how to use `@standardbeagle/web-console` in different scenarios.

## Examples Available

### 1. Standalone Server (`standalone-server/`)
A basic Go HTTP server with WebSocket terminal handler.

**Run:**
```bash
cd examples/standalone-server
go run main.go
```

Then open `http://localhost:8080` in your browser.

### 2. React App (`react-app/`)
A React application consuming the terminal component.

**Setup:**
```bash
cd examples/react-app
npm install
npm run server  # Start Go server in background
npm run dev     # Start React dev server
```

### 3. Wails App (`wails-app/`)
A complete Wails desktop application with embedded terminal.

**Setup:**
```bash
cd examples/wails-app
wails build
# or for development:
wails dev
```

## Usage Patterns

### Basic Usage
```tsx
import { Terminal } from '@standardbeagle/web-console';

function App() {
  return (
    <Terminal 
      url="ws://localhost:8080/ws/terminal"
      autoConnect={true}
    />
  );
}
```

### Advanced Usage with Events
```tsx
import { Terminal, useTerminal } from '@standardbeagle/web-console';

function AdvancedTerminal() {
  const {
    isConnected,
    sendData,
    connect,
    disconnect
  } = useTerminal({
    url: 'ws://localhost:8080/ws/terminal',
    onData: (data) => console.log('Received:', data),
    onError: (error) => console.error('Error:', error),
  });

  return (
    <div>
      <button onClick={connect} disabled={isConnected}>
        Connect
      </button>
      <button onClick={disconnect} disabled={!isConnected}>
        Disconnect
      </button>
      <Terminal url="ws://localhost:8080/ws/terminal" />
    </div>
  );
}
```

### Go Backend Setup
```go
import "github.com/standardbeagle/web-console/terminal"

func main() {
    handler := terminal.NewHandler()
    http.Handle("/ws/terminal", handler)
    
    // Serve static files
    http.Handle("/", http.FileServer(http.Dir("./static/")))
    
    log.Println("Server starting on :8080")
    http.ListenAndServe(":8080", nil)
}
```
package terminal

import (
	"context"
	"io"
	"os"
	"os/exec"
	"runtime"
	"sync"
	"syscall"
	"unsafe"

	"github.com/creack/pty"
)

type PTY struct {
	cmd    *exec.Cmd
	pty    *os.File
	cancel context.CancelFunc
	mu     sync.RWMutex
	closed bool
}

func NewPTY(cols, rows uint16) (*PTY, error) {
	ctx, cancel := context.WithCancel(context.Background())
	
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
		cancel()
		return nil, err
	}
	
	return &PTY{
		cmd:    cmd,
		pty:    ptyFile,
		cancel: cancel,
	}, nil
}

func (p *PTY) Read(buf []byte) (int, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	
	if p.closed {
		return 0, io.EOF
	}
	
	return p.pty.Read(buf)
}

func (p *PTY) Write(data []byte) (int, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	
	if p.closed {
		return 0, io.ErrClosedPipe
	}
	
	return p.pty.Write(data)
}

func (p *PTY) Resize(cols, rows uint16) error {
	p.mu.RLock()
	defer p.mu.RUnlock()
	
	if p.closed {
		return io.ErrClosedPipe
	}
	
	return pty.Setsize(p.pty, &pty.Winsize{
		Rows: rows,
		Cols: cols,
	})
}

func (p *PTY) SendSignal(sig syscall.Signal) error {
	p.mu.RLock()
	defer p.mu.RUnlock()
	
	if p.closed || p.cmd.Process == nil {
		return io.ErrClosedPipe
	}
	
	if runtime.GOOS == "windows" {
		return p.cmd.Process.Kill()
	}
	
	return p.cmd.Process.Signal(sig)
}

func (p *PTY) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	
	if p.closed {
		return nil
	}
	
	p.closed = true
	p.cancel()
	
	if p.pty != nil {
		p.pty.Close()
	}
	
	if p.cmd != nil && p.cmd.Process != nil {
		if runtime.GOOS == "windows" {
			p.cmd.Process.Kill()
		} else {
			p.cmd.Process.Signal(syscall.SIGTERM)
		}
	}
	
	return nil
}

func (p *PTY) Wait() error {
	if p.cmd == nil {
		return nil
	}
	return p.cmd.Wait()
}
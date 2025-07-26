package main

import (
	"context"
	"net/http"

	"github.com/standardbeagle/web-console/terminal"
)

type App struct {
	ctx             context.Context
	terminalHandler *terminal.Handler
	server          *http.Server
}

func NewApp() *App {
	return &App{
		terminalHandler: terminal.NewHandler(),
	}
}

func (a *App) OnStartup(ctx context.Context) {
	a.ctx = ctx
	
	mux := http.NewServeMux()
	mux.Handle("/ws/terminal", a.terminalHandler)
	
	a.server = &http.Server{
		Addr:    ":0", // Let system choose available port
		Handler: mux,
	}
	
	go func() {
		if err := a.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			// Log error but don't crash the app
		}
	}()
}

func (a *App) OnShutdown(ctx context.Context) {
	if a.server != nil {
		a.server.Shutdown(ctx)
	}
}

func (a *App) GetTerminalURL() string {
	if a.server == nil {
		return ""
	}
	
	addr := a.server.Addr
	if addr == ":0" {
		// In production, you'd need to get the actual assigned port
		// For now, return a placeholder
		return "ws://localhost:8080/ws/terminal"
	}
	
	return "ws://localhost" + addr + "/ws/terminal"
}
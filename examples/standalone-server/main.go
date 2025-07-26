package main

import (
	"log"
	"net/http"

	"github.com/standardbeagle/web-console/terminal"
)

func main() {
	terminalHandler := terminal.NewHandler()
	
	http.Handle("/ws/terminal", terminalHandler)
	
	http.Handle("/", http.FileServer(http.Dir("./static/")))
	
	log.Println("Server starting on :8080")
	log.Println("Terminal WebSocket endpoint: ws://localhost:8080/ws/terminal")
	log.Println("Static files served from ./static/")
	
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
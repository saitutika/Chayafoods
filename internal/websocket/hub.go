package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type BroadcastMessage struct {
	OrderID string `json:"order_id"`
	Payload any    `json:"payload"`
}

type Client struct {
	OrderID string
	Conn    *websocket.Conn
	Send    chan []byte
}

type Hub struct {
	mu      sync.RWMutex
	clients map[string]map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{clients: make(map[string]map[*Client]bool)}
}

func (h *Hub) Register(orderID string, conn *websocket.Conn) *Client {
	client := &Client{OrderID: orderID, Conn: conn, Send: make(chan []byte, 20)}
	h.mu.Lock()
	if _, ok := h.clients[orderID]; !ok {
		h.clients[orderID] = make(map[*Client]bool)
	}
	h.clients[orderID][client] = true
	h.mu.Unlock()
	go h.writePump(client)
	return client
}

func (h *Hub) Unregister(orderID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.clients[orderID]; ok {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.clients, orderID)
		}
	}
}

func (h *Hub) Broadcast(orderID string, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Println("marshal broadcast payload:", err)
		return
	}
	h.mu.RLock()
	clients := make([]*Client, 0, len(h.clients[orderID]))
	for client := range h.clients[orderID] {
		clients = append(clients, client)
	}
	h.mu.RUnlock()
	for _, client := range clients {
		select {
		case client.Send <- data:
		default:
			go h.Unregister(orderID, client)
		}
	}
}

func (h *Hub) HandleWebSocket(c *gin.Context, orderID string) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("upgrade websocket:", err)
		return
	}
	client := h.Register(orderID, conn)
	defer func() {
		_ = conn.Close()
		h.Unregister(orderID, client)
	}()
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			return
		}
	}
}

func (h *Hub) writePump(client *Client) {
	for {
		select {
		case msg, ok := <-client.Send:
			if !ok {
				_ = client.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := client.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
				return
			}
			if err := client.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		}
	}
}

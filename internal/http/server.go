package httpserver

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/example/fooddelivery/internal/domain"
	"github.com/example/fooddelivery/internal/repository"
	ws "github.com/example/fooddelivery/internal/websocket"
	"github.com/gin-gonic/gin"
)

type CreateOrderRequest struct {
	CustomerID     int64   `json:"customer_id"`
	RestaurantID   int64   `json:"restaurant_id"`
	AgentID        *int64  `json:"agent_id"`
	CustomerLat    float64 `json:"customer_lat"`
	CustomerLng    float64 `json:"customer_lng"`
	RestaurantLat  float64 `json:"restaurant_lat"`
	RestaurantLng  float64 `json:"restaurant_lng"`
	DestinationLat float64 `json:"destination_lat"`
	DestinationLng float64 `json:"destination_lng"`
	TotalAmount    float64 `json:"total_amount"`
}

type UpdateStatusRequest struct {
	Status domain.OrderStatus `json:"status"`
}

type DriverLocationRequest struct {
	AgentID   int64   `json:"agent_id"`
	OrderID   string  `json:"order_id"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type ProfileRequest struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
	Address    string `json:"address"`
	City       string `json:"city"`
	State      string `json:"state"`
	PostalCode string `json:"postal_code"`
}

type CreateMenuItemRequest struct {
	RestaurantID int64   `json:"restaurant_id"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	Category     string  `json:"category"`
	Price        float64 `json:"price"`
	ImageURL     string  `json:"image_url"`
}

type CreateMenuOrderRequest struct {
	CustomerID     int64   `json:"customer_id"`
	MenuItemID     int64   `json:"menu_item_id"`
	Quantity       int64   `json:"quantity"`
	DestinationLat float64 `json:"destination_lat"`
	DestinationLng float64 `json:"destination_lng"`
}

type App struct {
	repo     *repository.Repository
	hub      *ws.Hub
	sessions sync.RWMutex
	tokens   map[string]domain.AuthUser
}

func NewServer(repo *repository.Repository, hub *ws.Hub) *gin.Engine {
	app := &App{repo: repo, hub: hub, tokens: make(map[string]domain.AuthUser)}
	r := gin.Default()
	r.Use(corsMiddleware())
	r.POST("/orders", app.CreateOrder)
	r.POST("/orders/from-menu", app.CreateMenuOrder)
	r.POST("/auth/login", app.Login)
	r.GET("/auth/profile", app.Profile)
	r.PATCH("/auth/profile", app.UpdateProfile)
	r.GET("/menu-items", app.ListMenuItems)
	r.POST("/restaurants/:id/menu-items", app.CreateMenuItem)
	r.GET("/agents/:id/orders", app.AgentOrders)
	r.GET("/orders", app.ListOrders)
	r.GET("/orders/:id", app.GetOrder)
	r.PATCH("/orders/:id/status", app.UpdateOrderStatus)
	r.POST("/driver/location", app.DriverLocation)
	r.GET("/ws/track/orders/:id", func(c *gin.Context) {
		order, err := repo.GetOrder(c.Request.Context(), c.Param("id"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		if order.Status == domain.OrderDelivered {
			c.JSON(http.StatusGone, gin.H{"error": "live tracking expired after delivery"})
			return
		}
		hub.HandleWebSocket(c, c.Param("id"))
	})
	return r
}

func (a *App) CreateMenuOrder(c *gin.Context) {
	user, ok := a.authenticatedUser(c)
	if !ok || user.Role != domain.RoleCustomer {
		return
	}
	var req CreateMenuOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Quantity < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "customer, menu item, quantity, and destination are required"})
		return
	}
	order, err := a.repo.CreateOrderFromMenu(c.Request.Context(), user.ID, req.MenuItemID, req.Quantity, req.DestinationLat, req.DestinationLng)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if agentID, assignErr := a.repo.AssignNearestDriver(c.Request.Context(), order.ID, order.RestaurantLat, order.RestaurantLng, 10); assignErr == nil {
		order.AgentID = &agentID
		order.Status = domain.AgentAssigned
	}
	a.hub.Broadcast(order.ID, gin.H{"order_id": order.ID, "status": order.Status, "updated_at": time.Now().UTC().Format(time.RFC3339)})
	c.JSON(http.StatusCreated, order)
}

func (a *App) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	user, err := a.repo.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	token, err := createSessionToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create session"})
		return
	}
	a.sessions.Lock()
	a.tokens[token] = user
	a.sessions.Unlock()
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func (a *App) Profile(c *gin.Context) {
	user, ok := a.authenticatedUser(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, user)
}

func (a *App) UpdateProfile(c *gin.Context) {
	user, ok := a.authenticatedUser(c)
	if !ok {
		return
	}
	var req ProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	user.Name, user.Email, user.Phone = req.Name, req.Email, req.Phone
	user.Address, user.City, user.State, user.PostalCode = req.Address, req.City, req.State, req.PostalCode
	updated, err := a.repo.UpdateUserProfile(c.Request.Context(), user.ID, user)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	a.sessions.Lock()
	for token, sessionUser := range a.tokens {
		if sessionUser.ID == user.ID {
			a.tokens[token] = updated
		}
	}
	a.sessions.Unlock()
	c.JSON(http.StatusOK, updated)
}

func createSessionToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func (a *App) authenticatedUser(c *gin.Context) (domain.AuthUser, bool) {
	header := c.GetHeader("Authorization")
	if len(header) < 8 || header[:7] != "Bearer " {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return domain.AuthUser{}, false
	}
	a.sessions.RLock()
	user, ok := a.tokens[header[7:]]
	a.sessions.RUnlock()
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired session"})
		return domain.AuthUser{}, false
	}
	return user, true
}

func (a *App) ListMenuItems(c *gin.Context) {
	items, err := a.repo.ListMenuItems(c.Request.Context(), 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (a *App) CreateMenuItem(c *gin.Context) {
	user, ok := a.authenticatedUser(c)
	if !ok || user.Role != domain.RoleRestaurant || user.RestaurantID == nil {
		return
	}
	restaurantID := c.Param("id")
	var req CreateMenuItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var parsedID int64
	if _, err := fmt.Sscan(restaurantID, &parsedID); err != nil || parsedID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid restaurant id"})
		return
	}
	if *user.RestaurantID != parsedID {
		c.JSON(http.StatusForbidden, gin.H{"error": "restaurant account does not own this menu"})
		return
	}
	item, err := a.repo.CreateMenuItem(c.Request.Context(), domain.MenuItem{RestaurantID: parsedID, Name: req.Name, Description: req.Description, Category: req.Category, Price: req.Price, ImageURL: req.ImageURL})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (a *App) AgentOrders(c *gin.Context) {
	user, ok := a.authenticatedUser(c)
	if !ok || user.Role != domain.RoleDriver {
		return
	}
	var agentID int64
	if _, err := fmt.Sscan(c.Param("id"), &agentID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}
	if user.ID != agentID {
		c.JSON(http.StatusForbidden, gin.H{"error": "agent account does not own this queue"})
		return
	}
	orders, err := a.repo.ListAgentOrders(c.Request.Context(), agentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, orders)
}

func (a *App) ListOrders(c *gin.Context) {
	user, ok := a.authenticatedUser(c)
	if !ok || user.Role != domain.RoleCustomer {
		return
	}
	orders, err := a.repo.ListOrders(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	customerOrders := make([]domain.Order, 0, len(orders))
	for _, order := range orders {
		if order.CustomerID == user.ID {
			customerOrders = append(customerOrders, order)
		}
	}
	c.JSON(http.StatusOK, customerOrders)
}

func (a *App) GetOrder(c *gin.Context) {
	user, ok := a.authenticatedUser(c)
	if !ok || user.Role != domain.RoleCustomer {
		return
	}
	order, err := a.repo.GetOrder(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	if order.CustomerID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "order does not belong to this customer"})
		return
	}
	c.JSON(http.StatusOK, order)
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "http://localhost:5173")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func (a *App) CreateOrder(c *gin.Context) {
	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	order := domain.Order{
		ID:             domain.NewOrderID(),
		CustomerID:     req.CustomerID,
		RestaurantID:   req.RestaurantID,
		AgentID:        req.AgentID,
		Status:         domain.OrderInitialized,
		CustomerLat:    req.CustomerLat,
		CustomerLng:    req.CustomerLng,
		RestaurantLat:  req.RestaurantLat,
		RestaurantLng:  req.RestaurantLng,
		DestinationLat: req.DestinationLat,
		DestinationLng: req.DestinationLng,
		TotalAmount:    req.TotalAmount,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	stored, err := a.repo.CreateOrder(context.Background(), order)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if stored.AgentID == nil {
		if _, assignErr := a.repo.AssignNearestDriver(context.Background(), stored.ID, stored.RestaurantLat, stored.RestaurantLng, 10); assignErr == nil {
			stored, _ = a.repo.GetOrder(context.Background(), stored.ID)
		}
	}
	a.hub.Broadcast(stored.ID, gin.H{
		"order_id":   stored.ID,
		"status":     stored.Status,
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	c.JSON(http.StatusCreated, stored)
}

func (a *App) UpdateOrderStatus(c *gin.Context) {
	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	orderID := c.Param("id")
	updated, err := a.repo.UpdateOrderStatus(context.Background(), orderID, req.Status)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if updated.Status == domain.OrderDelivered && updated.AgentID != nil {
		_ = a.repo.SetDriverAvailable(context.Background(), *updated.AgentID, true)
	}
	a.hub.Broadcast(orderID, gin.H{
		"order_id":   orderID,
		"status":     updated.Status,
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	c.JSON(http.StatusOK, updated)
}

func (a *App) DriverLocation(c *gin.Context) {
	var req DriverLocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := a.repo.RecordDriverLocation(context.Background(), req.AgentID, req.OrderID, req.Latitude, req.Longitude); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	a.hub.Broadcast(req.OrderID, gin.H{
		"order_id":        req.OrderID,
		"status":          domain.AgentEnRouteToCustomer,
		"driver_location": gin.H{"lat": req.Latitude, "lng": req.Longitude},
		"updated_at":      time.Now().UTC().Format(time.RFC3339),
	})
	c.JSON(http.StatusAccepted, gin.H{"status": "ok"})
}

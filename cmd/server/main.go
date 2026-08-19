package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/example/fooddelivery/internal/config"
	"github.com/example/fooddelivery/internal/domain"
	httpserver "github.com/example/fooddelivery/internal/http"
	"github.com/example/fooddelivery/internal/repository"
	"github.com/example/fooddelivery/internal/websocket"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	repo, err := repository.NewRepository(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("cannot connect to PostgreSQL: %v\nCheck DATABASE_URL=%s\n", err, cfg.DatabaseURL)
	}
	defer func() { _ = repo.Close() }()

	schema, err := loadSchema()
	if err != nil {
		log.Fatalf("load database schema: %v", err)
	}
	if err := repo.InitializeSchema(ctx, schema); err != nil {
		log.Fatalf("initialize database schema: %v", err)
	}

	if err := repo.SeedSampleData(ctx); err != nil {
		log.Fatalf("seed sample data: %v", err)
	}

	hub := websocket.NewHub()
	r := httpserver.NewServer(repo, hub)

	go runOrderSimulation(ctx, repo, hub)

	addr := fmt.Sprintf(":%s", cfg.APIAddr)
	log.Printf("Food Delivery Tracking Engine started on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}

func loadSchema() ([]byte, error) {
	paths := []string{"../../sql/postgis_schema.sql", "sql/postgis_schema.sql"}
	for _, path := range paths {
		if schema, err := os.ReadFile(path); err == nil {
			return schema, nil
		}
	}
	return nil, fmt.Errorf("sql/postgis_schema.sql not found; run from the project root or cmd/server")
}

func runOrderSimulation(ctx context.Context, repo *repository.Repository, hub *websocket.Hub) {
	time.Sleep(2 * time.Second)

	order := domain.Order{
		ID:             domain.NewOrderID(),
		CustomerID:     1,
		RestaurantID:   1,
		Status:         domain.OrderInitialized,
		CustomerLat:    17.3850,
		CustomerLng:    78.4867,
		RestaurantLat:  17.3851,
		RestaurantLng:  78.4868,
		DestinationLat: 17.4100,
		DestinationLng: 78.4990,
		TotalAmount:    399.99,
	}
	created, err := repo.CreateOrder(ctx, order)
	if err != nil {
		log.Printf("create demo order: %v", err)
		return
	}
	log.Printf("demo order created: %s", created.ID)

	transitions := []domain.OrderStatus{
		domain.OrderAccepted,
		domain.FoodPreparing,
		domain.AgentAssigned,
		domain.AgentEnRouteToRestaurant,
		domain.AgentArrivedAtRestaurant,
		domain.OrderPickedUp,
		domain.AgentEnRouteToCustomer,
		domain.AgentArrivedAtCustomer,
		domain.OrderDelivered,
	}

	for _, nextStatus := range transitions {
		time.Sleep(1 * time.Second)
		updated, err := repo.UpdateOrderStatus(ctx, created.ID, nextStatus)
		if err != nil {
			log.Printf("status update failed: %s -> %s : %v", created.ID, nextStatus, err)
			continue
		}
		hub.Broadcast(created.ID, gin.H{
			"order_id":   created.ID,
			"status":     updated.Status,
			"updated_at": time.Now().UTC().Format(time.RFC3339),
		})
		log.Printf("status transitioned: %s -> %s", created.ID, updated.Status)
	}

	agentID, err := repo.FindNearestAvailableDriver(ctx, 17.3851, 78.4868, 10)
	if err != nil {
		log.Printf("nearest driver assignment: %v", err)
		return
	}
	if err := repo.SetDriverAvailable(ctx, agentID, true); err != nil {
		log.Printf("set driver available: %v", err)
	}

	for _, ping := range []struct{ lat, lng float64 }{
		{17.3852, 78.4869},
		{17.3890, 78.4905},
		{17.4000, 78.4950},
		{17.4100, 78.4990},
	} {
		time.Sleep(800 * time.Millisecond)
		if err := repo.RecordDriverLocation(ctx, agentID, created.ID, ping.lat, ping.lng); err != nil {
			log.Printf("record location ping: %v", err)
			continue
		}
		hub.Broadcast(created.ID, gin.H{
			"order_id":        created.ID,
			"status":          domain.AgentEnRouteToCustomer,
			"driver_location": gin.H{"lat": ping.lat, "lng": ping.lng},
			"updated_at":      time.Now().UTC().Format(time.RFC3339),
		})
	}
}

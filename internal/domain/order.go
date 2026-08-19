package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type OrderStatus string

const (
	OrderInitialized         OrderStatus = "ORDER_INITIALIZED"
	OrderAccepted            OrderStatus = "ORDER_ACCEPTED"
	FoodPreparing            OrderStatus = "FOOD_PREPARING"
	AgentAssigned            OrderStatus = "AGENT_ASSIGNED"
	AgentEnRouteToRestaurant OrderStatus = "AGENT_EN_ROUTE_TO_RESTAURANT"
	AgentArrivedAtRestaurant OrderStatus = "AGENT_ARRIVED_AT_RESTAURANT"
	OrderPickedUp            OrderStatus = "ORDER_PICKED_UP"
	AgentEnRouteToCustomer   OrderStatus = "AGENT_EN_ROUTE_TO_CUSTOMER"
	AgentArrivedAtCustomer   OrderStatus = "AGENT_ARRIVED_AT_CUSTOMER"
	OrderDelivered           OrderStatus = "ORDER_DELIVERED"
)

var validTransitions = map[OrderStatus][]OrderStatus{
	OrderInitialized:         {OrderAccepted, FoodPreparing},
	OrderAccepted:            {FoodPreparing},
	FoodPreparing:            {AgentAssigned},
	AgentAssigned:            {AgentEnRouteToRestaurant},
	AgentEnRouteToRestaurant: {AgentArrivedAtRestaurant},
	AgentArrivedAtRestaurant: {OrderPickedUp},
	OrderPickedUp:            {AgentEnRouteToCustomer},
	AgentEnRouteToCustomer:   {AgentArrivedAtCustomer},
	AgentArrivedAtCustomer:   {OrderDelivered},
	OrderDelivered:           {},
}

func (s OrderStatus) CanTransitionTo(next OrderStatus) bool {
	allowed, exists := validTransitions[s]
	if !exists {
		return false
	}
	for _, status := range allowed {
		if status == next {
			return true
		}
	}
	return false
}

func (s OrderStatus) String() string {
	return string(s)
}

type UserRole string

const (
	RoleCustomer   UserRole = "customer"
	RoleRestaurant UserRole = "restaurant"
	RoleDriver     UserRole = "driver"
	RoleAdmin      UserRole = "admin"
)

type User struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      UserRole  `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type Restaurant struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Lat       float64   `json:"lat"`
	Lng       float64   `json:"lng"`
	CreatedAt time.Time `json:"created_at"`
}

type DeliveryAgent struct {
	ID         int64     `json:"id"`
	Name       string    `json:"name"`
	Online     bool      `json:"online"`
	Available  bool      `json:"available"`
	CurrentLat float64   `json:"current_lat"`
	CurrentLng float64   `json:"current_lng"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type Order struct {
	ID             string      `json:"id"`
	CustomerID     int64       `json:"customer_id"`
	RestaurantID   int64       `json:"restaurant_id"`
	AgentID        *int64      `json:"agent_id,omitempty"`
	Status         OrderStatus `json:"status"`
	CustomerLat    float64     `json:"customer_lat"`
	CustomerLng    float64     `json:"customer_lng"`
	RestaurantLat  float64     `json:"restaurant_lat"`
	RestaurantLng  float64     `json:"restaurant_lng"`
	DestinationLat float64     `json:"destination_lat"`
	DestinationLng float64     `json:"destination_lng"`
	TotalAmount    float64     `json:"total_amount"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type MenuItem struct {
	ID           int64     `json:"id"`
	RestaurantID int64     `json:"restaurant_id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	Category     string    `json:"category"`
	Price        float64   `json:"price"`
	ImageURL     string    `json:"image_url"`
	IsAvailable  bool      `json:"is_available"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type AuthUser struct {
	ID           int64    `json:"id"`
	Name         string   `json:"name"`
	Email        string   `json:"email"`
	Role         UserRole `json:"role"`
	Phone        string   `json:"phone"`
	Address      string   `json:"address"`
	City         string   `json:"city"`
	State        string   `json:"state"`
	PostalCode   string   `json:"postal_code"`
	RestaurantID *int64   `json:"restaurant_id,omitempty"`
}

func NewOrderID() string {
	return uuid.NewString()
}

func (o Order) ValidateTransition(next OrderStatus) error {
	if !o.Status.CanTransitionTo(next) {
		return fmt.Errorf("illegal state transition from %s to %s", o.Status, next)
	}
	return nil
}

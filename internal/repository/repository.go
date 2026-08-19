package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/example/fooddelivery/internal/domain"
	_ "github.com/jackc/pgx/v5/stdlib"
)

type Repository struct {
	db *sql.DB
}

func (r *Repository) InitializeSchema(ctx context.Context, schema []byte) error {
	if len(schema) == 0 {
		return fmt.Errorf("database schema is empty")
	}
	if _, err := r.db.ExecContext(ctx, string(schema)); err != nil {
		return fmt.Errorf("initialize database schema: %w", err)
	}
	return nil
}

func NewRepository(ctx context.Context, dsn string) (*Repository, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)
	return &Repository{db: db}, nil
}

func (r *Repository) Close() error {
	if r == nil || r.db == nil {
		return nil
	}
	return r.db.Close()
}

func (r *Repository) CreateOrder(ctx context.Context, order domain.Order) (domain.Order, error) {
	if order.ID == "" {
		order.ID = domain.NewOrderID()
	}
	if order.CreatedAt.IsZero() {
		order.CreatedAt = time.Now().UTC()
	}
	order.UpdatedAt = time.Now().UTC()
	query := `
		INSERT INTO orders (
			id, customer_id, restaurant_id, agent_id, status,
			customer_geo, restaurant_geo, destination_geo, total_amount, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5,
			ST_SetSRID(ST_MakePoint($6, $7), 4326),
			ST_SetSRID(ST_MakePoint($8, $9), 4326),
			ST_SetSRID(ST_MakePoint($10, $11), 4326),
			$12, $13, $14)
	`
	_, err := r.db.ExecContext(ctx, query,
		order.ID,
		order.CustomerID,
		order.RestaurantID,
		order.AgentID,
		order.Status,
		order.CustomerLng,
		order.CustomerLat,
		order.RestaurantLng,
		order.RestaurantLat,
		order.DestinationLng,
		order.DestinationLat,
		order.TotalAmount,
		order.CreatedAt,
		order.UpdatedAt,
	)
	if err != nil {
		return domain.Order{}, fmt.Errorf("insert order: %w", err)
	}
	return order, nil
}

func (r *Repository) CreateOrderFromMenu(ctx context.Context, customerID, menuItemID, quantity int64, destinationLat, destinationLng float64) (domain.Order, error) {
	var order domain.Order
	var price float64
	if err := r.db.QueryRowContext(ctx, `
		SELECT m.restaurant_id, m.price, ST_X(r.location::geometry), ST_Y(r.location::geometry)
		FROM menu_items m JOIN restaurants r ON r.id = m.restaurant_id
		WHERE m.id = $1 AND m.is_available = true`, menuItemID).Scan(&order.RestaurantID, &price, &order.RestaurantLng, &order.RestaurantLat); err != nil {
		return domain.Order{}, fmt.Errorf("find menu item: %w", err)
	}
	order.ID = domain.NewOrderID()
	order.CustomerID = customerID
	order.Status = domain.OrderInitialized
	order.CustomerLat, order.CustomerLng = destinationLat, destinationLng
	order.DestinationLat, order.DestinationLng = destinationLat, destinationLng
	order.TotalAmount = price * float64(quantity)
	order.CreatedAt = time.Now().UTC()
	order.UpdatedAt = order.CreatedAt
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Order{}, fmt.Errorf("begin menu order tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	_, err = tx.ExecContext(ctx, `INSERT INTO orders (id, customer_id, restaurant_id, status, customer_geo, restaurant_geo, destination_geo, total_amount, created_at, updated_at) VALUES ($1,$2,$3,$4,ST_SetSRID(ST_MakePoint($5,$6),4326),ST_SetSRID(ST_MakePoint($7,$8),4326),ST_SetSRID(ST_MakePoint($9,$10),4326),$11,$12,$13)`, order.ID, order.CustomerID, order.RestaurantID, order.Status, order.CustomerLng, order.CustomerLat, order.RestaurantLng, order.RestaurantLat, order.DestinationLng, order.DestinationLat, order.TotalAmount, order.CreatedAt, order.UpdatedAt)
	if err != nil {
		return domain.Order{}, fmt.Errorf("insert menu order: %w", err)
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO order_line_items (order_id, menu_item_id, quantity, unit_price) VALUES ($1,$2,$3,$4)`, order.ID, menuItemID, quantity, price); err != nil {
		return domain.Order{}, fmt.Errorf("insert order item: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return domain.Order{}, fmt.Errorf("commit menu order: %w", err)
	}
	return order, nil
}

func (r *Repository) GetOrder(ctx context.Context, id string) (domain.Order, error) {
	query := `
		SELECT id, customer_id, restaurant_id, agent_id, status,
			ST_X(customer_geo::geometry) as customer_lng,
			ST_Y(customer_geo::geometry) as customer_lat,
			ST_X(restaurant_geo::geometry) as restaurant_lng,
			ST_Y(restaurant_geo::geometry) as restaurant_lat,
			ST_X(destination_geo::geometry) as destination_lng,
			ST_Y(destination_geo::geometry) as destination_lat,
			total_amount, created_at, updated_at
		FROM orders
		WHERE id = $1`
	row := r.db.QueryRowContext(ctx, query, id)
	var order domain.Order
	var agentID sql.NullInt64
	var createdAt, updatedAt time.Time
	if err := row.Scan(
		&order.ID,
		&order.CustomerID,
		&order.RestaurantID,
		&agentID,
		&order.Status,
		&order.CustomerLng,
		&order.CustomerLat,
		&order.RestaurantLng,
		&order.RestaurantLat,
		&order.DestinationLng,
		&order.DestinationLat,
		&order.TotalAmount,
		&createdAt,
		&updatedAt,
	); err != nil {
		return domain.Order{}, fmt.Errorf("scan order: %w", err)
	}
	if agentID.Valid {
		v := agentID.Int64
		order.AgentID = &v
	}
	order.CreatedAt = createdAt
	order.UpdatedAt = updatedAt
	return order, nil
}

func (r *Repository) ListOrders(ctx context.Context) ([]domain.Order, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, customer_id, restaurant_id, agent_id, status,
			ST_X(customer_geo::geometry), ST_Y(customer_geo::geometry),
			ST_X(restaurant_geo::geometry), ST_Y(restaurant_geo::geometry),
			ST_X(destination_geo::geometry), ST_Y(destination_geo::geometry),
			total_amount, created_at, updated_at
		FROM orders
		ORDER BY created_at DESC
		LIMIT 50`)
	if err != nil {
		return nil, fmt.Errorf("list orders: %w", err)
	}
	defer rows.Close()

	orders := make([]domain.Order, 0)
	for rows.Next() {
		var order domain.Order
		var agentID sql.NullInt64
		if err := rows.Scan(
			&order.ID, &order.CustomerID, &order.RestaurantID, &agentID, &order.Status,
			&order.CustomerLng, &order.CustomerLat,
			&order.RestaurantLng, &order.RestaurantLat,
			&order.DestinationLng, &order.DestinationLat,
			&order.TotalAmount, &order.CreatedAt, &order.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan order list: %w", err)
		}
		if agentID.Valid {
			value := agentID.Int64
			order.AgentID = &value
		}
		orders = append(orders, order)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate order list: %w", err)
	}
	return orders, nil
}

func (r *Repository) ListAgentOrders(ctx context.Context, agentID int64) ([]domain.Order, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, customer_id, restaurant_id, agent_id, status,
			ST_X(customer_geo::geometry), ST_Y(customer_geo::geometry),
			ST_X(restaurant_geo::geometry), ST_Y(restaurant_geo::geometry),
			ST_X(destination_geo::geometry), ST_Y(destination_geo::geometry),
			total_amount, created_at, updated_at
		FROM orders
		WHERE agent_id = $1 AND status <> 'ORDER_DELIVERED'
		ORDER BY created_at ASC`, agentID)
	if err != nil {
		return nil, fmt.Errorf("list agent orders: %w", err)
	}
	defer rows.Close()
	orders := make([]domain.Order, 0)
	for rows.Next() {
		var order domain.Order
		var assignedAgent sql.NullInt64
		if err := rows.Scan(&order.ID, &order.CustomerID, &order.RestaurantID, &assignedAgent, &order.Status, &order.CustomerLng, &order.CustomerLat, &order.RestaurantLng, &order.RestaurantLat, &order.DestinationLng, &order.DestinationLat, &order.TotalAmount, &order.CreatedAt, &order.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan agent order: %w", err)
		}
		if assignedAgent.Valid {
			value := assignedAgent.Int64
			order.AgentID = &value
		}
		orders = append(orders, order)
	}
	return orders, rows.Err()
}

func (r *Repository) UpdateOrderStatus(ctx context.Context, id string, nextStatus domain.OrderStatus) (domain.Order, error) {
	var current domain.Order
	var err error
	if current, err = r.GetOrder(ctx, id); err != nil {
		return domain.Order{}, err
	}
	if !current.Status.CanTransitionTo(nextStatus) {
		return domain.Order{}, fmt.Errorf("illegal state transition from %s to %s", current.Status, nextStatus)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Order{}, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err = tx.ExecContext(ctx, `SELECT 1 FROM orders WHERE id = $1 FOR UPDATE`, id); err != nil {
		return domain.Order{}, fmt.Errorf("lock order row: %w", err)
	}

	if _, err = tx.ExecContext(ctx, `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`, nextStatus, id); err != nil {
		return domain.Order{}, fmt.Errorf("update order status: %w", err)
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO order_status_logs(order_id,status,created_at) VALUES ($1,$2,NOW())`, id, nextStatus); err != nil {
		return domain.Order{}, fmt.Errorf("insert status log: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return domain.Order{}, fmt.Errorf("commit tx: %w", err)
	}

	current.Status = nextStatus
	current.UpdatedAt = time.Now().UTC()
	return current, nil
}

func (r *Repository) RecordDriverLocation(ctx context.Context, agentID int64, orderID string, lat, lng float64) error {
	query := `
		INSERT INTO driver_location_history (agent_id, order_id, geom, created_at)
		VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), NOW())
	`
	_, err := r.db.ExecContext(ctx, query, agentID, orderID, lng, lat)
	if err != nil {
		return fmt.Errorf("record driver location: %w", err)
	}
	updateDriver := `
		UPDATE delivery_agents
		SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
			updated_at = NOW()
		WHERE id = $3
	`
	_, err = r.db.ExecContext(ctx, updateDriver, lng, lat, agentID)
	if err != nil {
		return fmt.Errorf("update agent current location: %w", err)
	}
	return nil
}

func (r *Repository) FindNearestAvailableDriver(ctx context.Context, lat, lng float64, maxKM float64) (int64, error) {
	if maxKM <= 0 {
		maxKM = 10
	}
	query := `
		SELECT id
		FROM delivery_agents
		WHERE online = true AND available = true
			AND current_location IS NOT NULL
			AND ST_DWithin(current_location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
		ORDER BY ST_Distance(current_location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) ASC
		LIMIT 1
	`
	var agentID int64
	if err := r.db.QueryRowContext(ctx, query, lng, lat, maxKM).Scan(&agentID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, fmt.Errorf("no available driver found within %0.1f km", maxKM)
		}
		return 0, fmt.Errorf("find nearest available driver: %w", err)
	}
	return agentID, nil
}

func (r *Repository) SetDriverAvailable(ctx context.Context, agentID int64, available bool) error {
	_, err := r.db.ExecContext(ctx, `UPDATE delivery_agents SET available = $1, updated_at = NOW() WHERE id = $2`, available, agentID)
	if err != nil {
		return fmt.Errorf("set driver available: %w", err)
	}
	return nil
}

func (r *Repository) Login(ctx context.Context, email, password string) (domain.AuthUser, error) {
	var user domain.AuthUser
	var role string
	var restaurantID sql.NullInt64
	var passwordHash string
	err := r.db.QueryRowContext(ctx, `
		SELECT u.id, u.name, u.email, u.role, u.password_hash, u.phone, u.address, u.city, u.state, u.postal_code, r.id
		FROM users u
		LEFT JOIN restaurants r ON r.id = u.id AND u.role = 'restaurant'
		WHERE LOWER(u.email) = LOWER($1)`, email).Scan(
		&user.ID, &user.Name, &user.Email, &role, &passwordHash, &user.Phone, &user.Address, &user.City, &user.State, &user.PostalCode, &restaurantID)
	if err != nil {
		return domain.AuthUser{}, fmt.Errorf("login: %w", err)
	}
	if passwordHash != password {
		return domain.AuthUser{}, fmt.Errorf("invalid credentials")
	}
	user.Role = domain.UserRole(role)
	if restaurantID.Valid {
		value := restaurantID.Int64
		user.RestaurantID = &value
	}
	return user, nil
}

func (r *Repository) UpdateUserProfile(ctx context.Context, userID int64, user domain.AuthUser) (domain.AuthUser, error) {
	if _, err := r.db.ExecContext(ctx, `
		UPDATE users
		SET name = $1, email = $2, phone = $3, address = $4, city = $5, state = $6, postal_code = $7
		WHERE id = $8`, user.Name, user.Email, user.Phone, user.Address, user.City, user.State, user.PostalCode, userID); err != nil {
		return domain.AuthUser{}, fmt.Errorf("update user profile: %w", err)
	}
	user.ID = userID
	return user, nil
}

func (r *Repository) ListMenuItems(ctx context.Context, restaurantID int64) ([]domain.MenuItem, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, restaurant_id, name, description, category, price, image_url, is_available, created_at, updated_at
		FROM menu_items
		WHERE ($1 = 0 OR restaurant_id = $1) AND is_available = true
		ORDER BY created_at DESC`, restaurantID)
	if err != nil {
		return nil, fmt.Errorf("list menu items: %w", err)
	}
	defer rows.Close()
	items := make([]domain.MenuItem, 0)
	for rows.Next() {
		var item domain.MenuItem
		if err := rows.Scan(&item.ID, &item.RestaurantID, &item.Name, &item.Description, &item.Category, &item.Price, &item.ImageURL, &item.IsAvailable, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan menu item: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) CreateMenuItem(ctx context.Context, item domain.MenuItem) (domain.MenuItem, error) {
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO menu_items (restaurant_id, name, description, category, price, image_url)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`, item.RestaurantID, item.Name, item.Description, item.Category, item.Price, item.ImageURL).Scan(&item.ID, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return domain.MenuItem{}, fmt.Errorf("create menu item: %w", err)
	}
	item.IsAvailable = true
	return item, nil
}

func (r *Repository) AssignNearestDriver(ctx context.Context, orderID string, lat, lng float64, maxKM float64) (int64, error) {
	agentID, err := r.FindNearestAvailableDriver(ctx, lat, lng, maxKM)
	if err != nil {
		return 0, err
	}
	result, err := r.db.ExecContext(ctx, `UPDATE orders SET agent_id = $1, status = 'AGENT_ASSIGNED', updated_at = NOW() WHERE id = $2 AND agent_id IS NULL`, agentID, orderID)
	if err != nil {
		return 0, fmt.Errorf("assign driver: %w", err)
	}
	if count, _ := result.RowsAffected(); count == 0 {
		return 0, fmt.Errorf("order already has a driver")
	}
	if err := r.SetDriverAvailable(ctx, agentID, false); err != nil {
		return 0, err
	}
	return agentID, nil
}

func (r *Repository) CreateSampleDriver(ctx context.Context, id int64, name string, lat, lng float64) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO delivery_agents (id, name, online, available, current_location, updated_at)
		VALUES ($1, $2, true, true, ST_SetSRID(ST_MakePoint($3, $4), 4326), NOW())
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			online = EXCLUDED.online,
			available = EXCLUDED.available,
			current_location = EXCLUDED.current_location,
			updated_at = NOW()
	`, id, name, lng, lat)
	return err
}

func (r *Repository) SeedSampleData(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, role) VALUES
		(1, 'Alice Customer', 'alice@example.com', 'customer123', 'customer'),
		(2, 'Bob Restaurant', 'bob-rest@example.com', 'restaurant123', 'restaurant'),
		(101, 'Kiran Driver', 'driver@example.com', 'driver123', 'driver')
		ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
	`)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO menu_items (restaurant_id, name, description, category, price, image_url) VALUES
		(1, 'Smash Burger', 'Double patty, house sauce, crisp lettuce', 'Burgers', 249.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85'),
		(1, 'Loaded Fries', 'Seasoned fries with cheese and herbs', 'Fast food', 149.00, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=85'),
		(2, 'Hyderabadi Biryani', 'Aromatic basmati rice with slow-cooked chicken', 'Biryani', 299.00, 'https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=900&q=85')
		ON CONFLICT DO NOTHING
	`)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO restaurants (id, name, location) VALUES
		(1, 'Urban Bites', ST_SetSRID(ST_MakePoint(78.4867, 17.3850), 4326)),
		(2, 'Spice Avenue', ST_SetSRID(ST_MakePoint(78.4900, 17.3900), 4326))
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			location = EXCLUDED.location
	`)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO delivery_agents (id, name, online, available, current_location) VALUES
		(101, 'Kiran Driver', true, true, ST_SetSRID(ST_MakePoint(78.4700, 17.4200), 4326)),
		(102, 'Naveen Driver', true, true, ST_SetSRID(ST_MakePoint(78.4750, 17.4150), 4326))
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			online = EXCLUDED.online,
			available = EXCLUDED.available,
			current_location = EXCLUDED.current_location,
			updated_at = NOW()
	`)
	return err
}

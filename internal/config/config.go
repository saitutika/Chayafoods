package config

import (
	"fmt"
	"os"
)

type Config struct {
	APIAddr         string
	DatabaseURL     string
	PostgresURL     string
	WebsocketPath   string
	MaxAssignmentKM float64
}

func Load() Config {
	cfg := Config{
		APIAddr:         getEnv("PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable"),
		PostgresURL:     getEnv("POSTGRES_URL", "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable"),
		WebsocketPath:   getEnv("WS_PATH", "/ws/track/orders"),
		MaxAssignmentKM: 10,
	}
	if v := os.Getenv("MAX_ASSIGNMENT_KM"); v != "" {
		_, err := fmt.Sscanf(v, "%f", &cfg.MaxAssignmentKM)
		if err != nil {
			cfg.MaxAssignmentKM = 10
		}
	}
	return cfg
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}

-- Initialization script for PostgreSQL
-- This file runs automatically when the database container is first created
-- It's useful for any initial setup that should happen before migrations

-- Enable PostGIS extension (already handled in schema.sql, but good to have here too)
CREATE EXTENSION IF NOT EXISTS postgis;

-- You can add any other initialization logic here
-- For example, creating additional databases, users, or extensions


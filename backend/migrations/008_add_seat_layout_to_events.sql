-- Add seat layout configuration columns to events
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS seat_map_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS seat_rows INT,
    ADD COLUMN IF NOT EXISTS seat_columns INT;

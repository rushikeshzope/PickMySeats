-- Add Google Maps URL, gate open time, and event end time to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gate_open_time TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_end_time TIMESTAMPTZ;

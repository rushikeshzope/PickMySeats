-- Add cancellation_type and ensure existing indices cover joined queries efficiently
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS cancellation_type TEXT NOT NULL DEFAULT 'none'
CHECK (cancellation_type IN ('none', 'user', 'organizer'));

-- Index for performance in my_tickets (joined with event_seats)
CREATE INDEX IF NOT EXISTS idx_tickets_seat_id ON tickets(seat_id) WHERE seat_id IS NOT NULL;

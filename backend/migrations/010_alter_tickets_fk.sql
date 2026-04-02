-- Drop the old foreign key constraint because seat_id now references event_seats(id) instead of the old seats table
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_seat_id_fkey;

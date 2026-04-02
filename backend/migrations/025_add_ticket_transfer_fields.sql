-- Add ticket transfer tracking fields to tickets table
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS transfer_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS transferred_to_name TEXT,
  ADD COLUMN IF NOT EXISTS transferred_to_phone TEXT,
  ADD COLUMN IF NOT EXISTS transferred_to_email TEXT,
  ADD COLUMN IF NOT EXISTS original_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;

-- Index for looking up tickets by transferee email (for signup linking)
CREATE INDEX IF NOT EXISTS idx_tickets_transferred_to_email ON tickets(transferred_to_email) WHERE transferred_to_email IS NOT NULL;

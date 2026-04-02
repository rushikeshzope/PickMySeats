-- Pending ticket transfers for recipients who don't have an account yet
CREATE TABLE IF NOT EXISTS pending_ticket_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimize lookup by email (used during signup to link tickets)
CREATE INDEX IF NOT EXISTS idx_pending_transfers_email ON pending_ticket_transfers(recipient_email);
CREATE INDEX IF NOT EXISTS idx_pending_transfers_ticket ON pending_ticket_transfers(ticket_id);

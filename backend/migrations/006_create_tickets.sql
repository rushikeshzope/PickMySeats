-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    event_id UUID NOT NULL REFERENCES events(id),
    seat_id UUID REFERENCES seats(id),
    user_id UUID NOT NULL REFERENCES users(id),
    qr_code_data TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'valid',
    scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_event ON tickets(event_id);
CREATE INDEX idx_tickets_user ON tickets(user_id);
CREATE INDEX idx_tickets_order ON tickets(order_id);
CREATE INDEX idx_tickets_status ON tickets(status);

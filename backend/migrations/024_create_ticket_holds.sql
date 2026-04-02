-- Ticket holds for standard (non-seat-map) events
CREATE TABLE IF NOT EXISTS ticket_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimize checking total held for an event
CREATE INDEX idx_ticket_holds_event ON ticket_holds(event_id);
CREATE INDEX idx_ticket_holds_user_event ON ticket_holds(user_id, event_id);
CREATE INDEX idx_ticket_holds_expires ON ticket_holds(expires_at);

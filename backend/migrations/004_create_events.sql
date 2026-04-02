-- Events table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    venue_id UUID REFERENCES venues(id),
    organizer_id UUID NOT NULL REFERENCES users(id),
    event_date TIMESTAMPTZ NOT NULL,
    ticket_price DECIMAL(10,2) NOT NULL,
    vip_price DECIMAL(10,2),
    max_tickets INT NOT NULL,
    tickets_sold INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_events_date ON events(event_date);

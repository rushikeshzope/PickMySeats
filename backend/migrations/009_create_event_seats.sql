-- Per-event seat table for seat-map-enabled events
CREATE TABLE IF NOT EXISTS event_seats (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    row_label    VARCHAR(5)  NOT NULL,
    seat_number  INT         NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'available',   -- available | locked | booked
    locked_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    locked_until TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT event_seats_unique UNIQUE (event_id, row_label, seat_number),
    CONSTRAINT event_seats_status_check CHECK (status IN ('available', 'locked', 'booked'))
);

CREATE INDEX idx_event_seats_event   ON event_seats(event_id);
CREATE INDEX idx_event_seats_status  ON event_seats(event_id, status);
CREATE INDEX idx_event_seats_locked  ON event_seats(locked_until) WHERE status = 'locked';

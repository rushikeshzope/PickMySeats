-- Add selected status for seat map (client-side selection before payment lock)
-- The 'selected' state is purely frontend; backend statuses remain available | locked | booked
-- Add order_status to orders to differentiate pending payment vs confirmed
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'paid'
    CHECK (order_status IN ('pending_payment', 'paid', 'failed'));

-- Add event refund policy
ALTER TABLE events
ADD COLUMN IF NOT EXISTS refund_policy TEXT NOT NULL DEFAULT 'NON_REFUNDABLE'
CHECK (refund_policy IN ('REFUNDABLE', 'NON_REFUNDABLE'));

-- Align ticket status with cancellation flow and add refund tracking
ALTER TABLE tickets
ALTER COLUMN status SET DEFAULT 'active';

UPDATE tickets
SET status = 'active'
WHERE status = 'valid';

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none'
CHECK (refund_status IN ('none', 'pending', 'refunded'));

-- Store Razorpay references required for refunds
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
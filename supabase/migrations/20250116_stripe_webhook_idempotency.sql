-- ============================================
-- STRIPE WEBHOOK IDEMPOTENCY TABLE
-- Migration: 20250116_stripe_webhook_idempotency
-- Purpose: Prevent duplicate webhook processing
-- ============================================

-- Create table to track processed Stripe webhook events
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by event_id
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id
ON stripe_webhook_events(event_id);

-- Index for cleanup of old events
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created_at
ON stripe_webhook_events(created_at);

-- Comment for documentation
COMMENT ON TABLE stripe_webhook_events IS 'Tracks processed Stripe webhook events for idempotency';
COMMENT ON COLUMN stripe_webhook_events.event_id IS 'Stripe event ID (evt_xxx)';
COMMENT ON COLUMN stripe_webhook_events.event_type IS 'Stripe event type (e.g., checkout.session.completed)';

-- RLS Policy: Only service role can access this table
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- No public access - only service role key can read/write
-- This is intentional - webhooks use service role key

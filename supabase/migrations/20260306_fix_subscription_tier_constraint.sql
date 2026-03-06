-- Fix subscription_tier CHECK constraint to include 'plus' tier
-- The app uses 'plus' but the original constraint only allowed 'basic'
-- Keep 'basic' as a valid value for any legacy data

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'basic', 'plus', 'pro', 'executive'));

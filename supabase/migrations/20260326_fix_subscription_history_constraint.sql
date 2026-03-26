-- Fix subscription_history tier CHECK constraint to include 'plus'
-- The original constraint only allowed ('free', 'basic', 'pro', 'executive')
-- but the app uses 'plus' instead of 'basic'

ALTER TABLE public.subscription_history
  DROP CONSTRAINT IF EXISTS subscription_history_tier_check;

ALTER TABLE public.subscription_history
  ADD CONSTRAINT subscription_history_tier_check
  CHECK (tier IN ('free', 'basic', 'plus', 'pro', 'executive'));

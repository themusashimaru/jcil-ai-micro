-- ============================================
-- UPDATE SUBSCRIPTION TIER PRICING & LIMITS
-- ============================================
-- Updates pricing and message limits to match new structure
-- NOTE: Backend limits are GENEROUS (underpromise, overdeliver strategy)
-- Users see conservative limits on landing page, but get much more!

-- Displayed Limits: Free=10, Basic=30, Pro=100, Executive=200
-- Actual Limits:    Free=10, Basic=120, Pro=250, Executive=1000

-- Update FREE tier users (10 messages/day - matches what's displayed)
UPDATE public.user_profiles
SET daily_message_limit = 10,
    monthly_price = 0
WHERE subscription_tier = 'free';

-- Update BASIC tier users ($12/month, 120 messages/day actual - displays 30)
UPDATE public.user_profiles
SET daily_message_limit = 120,
    monthly_price = 12
WHERE subscription_tier = 'basic';

-- Update PRO tier users ($30/month, 250 messages/day actual - displays 100)
UPDATE public.user_profiles
SET daily_message_limit = 250,
    monthly_price = 30
WHERE subscription_tier = 'pro';

-- Update EXECUTIVE tier users ($150/month, 1000 messages/day actual - displays 200)
UPDATE public.user_profiles
SET daily_message_limit = 1000,
    monthly_price = 150
WHERE subscription_tier = 'executive';

-- Log the updates
DO $$
BEGIN
  RAISE NOTICE 'Pricing tiers updated with GENEROUS backend limits:';
  RAISE NOTICE 'FREE: $0/month, 10 messages/day (displayed: 10)';
  RAISE NOTICE 'BASIC: $12/month, 120 messages/day (displayed: 30) - 4x bonus!';
  RAISE NOTICE 'PRO: $30/month, 250 messages/day (displayed: 100) - 2.5x bonus!';
  RAISE NOTICE 'EXECUTIVE: $150/month, 1000 messages/day (displayed: 200) - 5x bonus!';
  RAISE NOTICE 'Strategy: Underpromise on landing page, overdeliver in practice = happy users!';
END $$;

-- ============================================
-- UPDATE SUBSCRIPTION TIER PRICING
-- ============================================
-- Updates pricing and message limits to match new structure:
-- FREE: $0/month, 10 messages/day
-- BASIC: $12/month
-- PRO: $30/month
-- EXECUTIVE: $150/month

-- Update free tier users to have 10 messages per day instead of 5
UPDATE public.user_profiles
SET daily_message_limit = 10
WHERE subscription_tier = 'free' AND daily_message_limit = 5;

-- Update basic tier users to new pricing
UPDATE public.user_profiles
SET monthly_price = 12
WHERE subscription_tier = 'basic';

-- Update pro tier users to new pricing
UPDATE public.user_profiles
SET monthly_price = 30
WHERE subscription_tier = 'pro';

-- Update executive tier users to new pricing
UPDATE public.user_profiles
SET monthly_price = 150
WHERE subscription_tier = 'executive';

-- Log the updates
DO $$
BEGIN
  RAISE NOTICE 'Pricing tiers updated:';
  RAISE NOTICE 'FREE: $0/month, 10 messages/day';
  RAISE NOTICE 'BASIC: $12/month';
  RAISE NOTICE 'PRO: $30/month';
  RAISE NOTICE 'EXECUTIVE: $150/month';
END $$;

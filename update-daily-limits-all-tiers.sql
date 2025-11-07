-- ============================================
-- UPDATE DAILY MESSAGE LIMITS FOR ALL TIERS
-- ============================================
-- This migration updates daily message limits to control costs
-- while providing generous limits for each subscription tier.

-- Update Free tier: 10 messages per day
UPDATE public.user_profiles
SET daily_message_limit = 10
WHERE subscription_tier = 'free';

-- Update Basic/Pro tier: 80 messages per day
UPDATE public.user_profiles
SET daily_message_limit = 80
WHERE subscription_tier IN ('basic', 'pro');

-- Update Premium tier: 200 messages per day
UPDATE public.user_profiles
SET daily_message_limit = 200
WHERE subscription_tier = 'premium';

-- Update Executive tier: 1500 messages per day
UPDATE public.user_profiles
SET daily_message_limit = 1500
WHERE subscription_tier = 'executive';

-- ============================================
-- REFERENCE: TIER LIMITS
-- ============================================
-- FREE: 10 messages/day
-- BASIC/PRO: 80 messages/day
-- PREMIUM: 200 messages/day
-- EXECUTIVE: 1500 messages/day
--
-- Additional protections:
-- - Rapid-fire: 10 messages per minute (anti-spam)
-- - Hourly: 60 messages per hour (anti-abuse)
-- ============================================

-- Verify the updates
SELECT
  subscription_tier,
  COUNT(*) as user_count,
  daily_message_limit
FROM public.user_profiles
GROUP BY subscription_tier, daily_message_limit
ORDER BY daily_message_limit;

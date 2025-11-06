-- ============================================
-- UPDATE SUBSCRIPTION TIERS WITH DAILY LIMITS
-- ============================================

-- Drop old constraint if exists
ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS valid_tier;

-- Add new constraint with all tiers
ALTER TABLE public.user_profiles
ADD CONSTRAINT valid_tier CHECK (
  subscription_tier IN ('free', 'basic', 'pro', 'executive')
);

-- Add pricing and limit metadata columns
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS monthly_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_message_limit INTEGER DEFAULT 5;

-- Update existing 'free' users with correct limits
UPDATE public.user_profiles
SET monthly_price = 0, daily_message_limit = 5
WHERE subscription_tier = 'free';

-- Update any 'paid' users to 'basic' (migration from old system)
UPDATE public.user_profiles
SET subscription_tier = 'basic', monthly_price = 20, daily_message_limit = 30
WHERE subscription_tier = 'paid';

-- ============================================
-- CREATE DAILY USAGE TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Ensure one row per user per day
  UNIQUE(user_id, usage_date)
);

-- Enable Row Level Security
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own usage
CREATE POLICY "Users can view own usage"
  ON public.daily_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert/update usage
CREATE POLICY "Service role can manage usage"
  ON public.daily_usage
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date
  ON public.daily_usage(user_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_daily_usage_date
  ON public.daily_usage(usage_date);

-- ============================================
-- FUNCTION: Get or create today's usage record
-- ============================================

CREATE OR REPLACE FUNCTION public.get_or_create_daily_usage(p_user_id UUID)
RETURNS public.daily_usage AS $$
DECLARE
  v_usage public.daily_usage;
BEGIN
  -- Try to get today's record
  SELECT * INTO v_usage
  FROM public.daily_usage
  WHERE user_id = p_user_id
    AND usage_date = CURRENT_DATE;

  -- If not found, create it
  IF NOT FOUND THEN
    INSERT INTO public.daily_usage (user_id, usage_date, message_count, token_count)
    VALUES (p_user_id, CURRENT_DATE, 0, 0)
    RETURNING * INTO v_usage;
  END IF;

  RETURN v_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Increment message count
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_message_count(
  p_user_id UUID,
  p_token_count INTEGER DEFAULT 0
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Upsert: increment if exists, create if not
  INSERT INTO public.daily_usage (user_id, usage_date, message_count, token_count, updated_at)
  VALUES (p_user_id, CURRENT_DATE, 1, p_token_count, NOW())
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    message_count = public.daily_usage.message_count + 1,
    token_count = public.daily_usage.token_count + p_token_count,
    updated_at = NOW();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Check if user has remaining messages
-- ============================================

CREATE OR REPLACE FUNCTION public.check_daily_limit(p_user_id UUID)
RETURNS TABLE(
  has_remaining BOOLEAN,
  current_count INTEGER,
  daily_limit INTEGER,
  tier TEXT
) AS $$
DECLARE
  v_profile RECORD;
  v_usage RECORD;
BEGIN
  -- Get user's tier and limit
  SELECT subscription_tier, daily_message_limit
  INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  -- Get today's usage (or 0 if no record)
  SELECT COALESCE(message_count, 0) as msg_count
  INTO v_usage
  FROM public.daily_usage
  WHERE user_id = p_user_id
    AND usage_date = CURRENT_DATE;

  -- If no usage record exists, user has full limit available
  IF NOT FOUND THEN
    v_usage.msg_count := 0;
  END IF;

  -- Return the result
  RETURN QUERY SELECT
    (v_usage.msg_count < v_profile.daily_message_limit) as has_remaining,
    v_usage.msg_count as current_count,
    v_profile.daily_message_limit as daily_limit,
    v_profile.subscription_tier as tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CLEANUP: Delete usage records older than 90 days
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_old_usage()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.daily_usage
  WHERE usage_date < CURRENT_DATE - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- REFERENCE DATA: Tier Pricing (for documentation)
-- ============================================

-- FREE: $0/month, 5 messages/day, Haiku 4
-- BASIC: $20/month, 30 messages/day, Haiku 4.5
-- PRO: $60/month, 100 messages/day, Haiku 4.5
-- EXECUTIVE: $99/month, 200 messages/day, Haiku 4.5 (or Sonnet 4)

COMMENT ON TABLE public.user_profiles IS 'User subscription tier and pricing information';
COMMENT ON TABLE public.daily_usage IS 'Daily message and token usage tracking per user';
COMMENT ON COLUMN public.user_profiles.subscription_tier IS 'Subscription tier: free, basic, pro, executive';
COMMENT ON COLUMN public.user_profiles.monthly_price IS 'Monthly subscription price in USD';
COMMENT ON COLUMN public.user_profiles.daily_message_limit IS 'Maximum messages allowed per day';

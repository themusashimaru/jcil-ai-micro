-- ============================================
-- API KEY LOAD BALANCING SYSTEM
-- ============================================
-- This migration adds load balancing across multiple XAI API keys
-- to handle massive scale (5M+ users)
--
-- Supports up to 100 API keys with automatic detection
-- Keys: XAI_API_KEY (key #1), XAI_API_KEY_2, XAI_API_KEY_3, ..., XAI_API_KEY_100

-- ============================================
-- 1. ADD API KEY GROUP TO USER PROFILES
-- ============================================
-- Add api_key_group column to assign each user to a specific API key
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS api_key_group INTEGER DEFAULT 1;

-- Add constraint to ensure valid key group (1-100)
ALTER TABLE public.user_profiles
ADD CONSTRAINT valid_api_key_group CHECK (api_key_group >= 1 AND api_key_group <= 100);

-- Create index for fast key group lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_api_key_group
ON public.user_profiles(api_key_group);

-- ============================================
-- 2. API KEY USAGE TRACKING TABLE
-- ============================================
-- Track usage statistics per API key for monitoring and load balancing
CREATE TABLE IF NOT EXISTS public.api_key_stats (
  key_group INTEGER PRIMARY KEY CHECK (key_group >= 1 AND key_group <= 100),
  user_count INTEGER DEFAULT 0,
  total_requests BIGINT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS (admin-only access)
ALTER TABLE public.api_key_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read stats
CREATE POLICY "Admins can view API key stats"
  ON public.api_key_stats
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_api_key_stats_key_group
ON public.api_key_stats(key_group);

-- ============================================
-- 3. FUNCTION: GET NEXT AVAILABLE API KEY GROUP (Round-Robin)
-- ============================================
-- Returns the API key group with the LEAST number of users assigned
-- This ensures even distribution across all available keys
CREATE OR REPLACE FUNCTION public.get_next_api_key_group()
RETURNS INTEGER AS $$
DECLARE
  next_group INTEGER;
BEGIN
  -- Find the key group with the least users assigned
  SELECT COALESCE(
    (
      SELECT key_group
      FROM public.api_key_stats
      ORDER BY user_count ASC, key_group ASC
      LIMIT 1
    ),
    1 -- Default to key group 1 if no stats exist yet
  ) INTO next_group;

  RETURN next_group;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. FUNCTION: INCREMENT API KEY STATS
-- ============================================
-- Called after each API request to track usage
CREATE OR REPLACE FUNCTION public.increment_api_key_stats(
  p_key_group INTEGER,
  p_tokens INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.api_key_stats (key_group, total_requests, total_tokens, last_request_at, user_count)
  VALUES (p_key_group, 1, p_tokens, NOW(), 0)
  ON CONFLICT (key_group) DO UPDATE
  SET
    total_requests = api_key_stats.total_requests + 1,
    total_tokens = api_key_stats.total_tokens + p_tokens,
    last_request_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. UPDATE handle_new_user TRIGGER TO ASSIGN API KEY GROUP
-- ============================================
-- Modify the existing trigger to assign new users to the least-loaded API key
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_key_group INTEGER;
BEGIN
  -- Get the next available API key group (least loaded)
  assigned_key_group := public.get_next_api_key_group();

  -- Create user profile with assigned API key group
  INSERT INTO public.user_profiles (id, subscription_tier, api_key_group)
  VALUES (NEW.id, 'free', assigned_key_group)
  ON CONFLICT (id) DO UPDATE
  SET api_key_group = assigned_key_group;

  -- Update user count for this key group
  INSERT INTO public.api_key_stats (key_group, user_count)
  VALUES (assigned_key_group, 1)
  ON CONFLICT (key_group) DO UPDATE
  SET user_count = api_key_stats.user_count + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. BACKFILL EXISTING USERS WITH API KEY GROUPS
-- ============================================
-- Assign existing users to API key groups using round-robin distribution
DO $$
DECLARE
  total_users INTEGER;
  current_key_group INTEGER := 1;
  max_key_group INTEGER := 31; -- Start with 31 keys (can scale to 100)
BEGIN
  -- Get total number of users
  SELECT COUNT(*) INTO total_users FROM public.user_profiles WHERE api_key_group IS NULL;

  -- If there are users without assigned keys, distribute them
  IF total_users > 0 THEN
    -- Update users in batches, cycling through key groups
    FOR user_record IN
      SELECT id
      FROM public.user_profiles
      WHERE api_key_group IS NULL OR api_key_group = 1
      ORDER BY created_at ASC
    LOOP
      -- Assign user to current key group
      UPDATE public.user_profiles
      SET api_key_group = current_key_group
      WHERE id = user_record.id;

      -- Move to next key group (round-robin)
      current_key_group := current_key_group + 1;
      IF current_key_group > max_key_group THEN
        current_key_group := 1;
      END IF;
    END LOOP;

    -- Rebuild stats after backfill
    INSERT INTO public.api_key_stats (key_group, user_count)
    SELECT api_key_group, COUNT(*)
    FROM public.user_profiles
    GROUP BY api_key_group
    ON CONFLICT (key_group) DO UPDATE
    SET user_count = EXCLUDED.user_count;
  END IF;
END $$;

-- ============================================
-- 7. HELPER FUNCTION: GET API KEY STATS (Admin)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_api_key_stats()
RETURNS TABLE (
  key_group INTEGER,
  user_count INTEGER,
  total_requests BIGINT,
  total_tokens BIGINT,
  last_request_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.key_group,
    s.user_count,
    s.total_requests,
    s.total_tokens,
    s.last_request_at
  FROM public.api_key_stats s
  ORDER BY s.key_group ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON COLUMN public.user_profiles.api_key_group IS 'API key group assigned to this user (1-100) for load balancing';
COMMENT ON TABLE public.api_key_stats IS 'Tracks usage statistics per API key group for monitoring and load balancing';
COMMENT ON FUNCTION public.get_next_api_key_group() IS 'Returns the API key group with the least users (round-robin load balancing)';
COMMENT ON FUNCTION public.increment_api_key_stats(INTEGER, INTEGER) IS 'Increments request and token counts for an API key group';

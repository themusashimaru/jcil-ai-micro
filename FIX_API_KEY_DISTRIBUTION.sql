-- ============================================
-- FIX: REDISTRIBUTE USERS ACROSS ALL 31 KEYS
-- ============================================
-- This will evenly distribute ALL users across keys 1-31

-- Step 1: Clear existing stats (we'll rebuild them)
TRUNCATE public.api_key_stats;

-- Step 2: Redistribute all users evenly across 31 keys
DO $$
DECLARE
  user_record RECORD;
  current_key_group INTEGER := 1;
  max_key_group INTEGER := 31;
  user_count INTEGER := 0;
BEGIN
  -- Loop through ALL users and reassign them
  FOR user_record IN
    SELECT id
    FROM public.user_profiles
    ORDER BY created_at ASC
  LOOP
    -- Assign user to current key group
    UPDATE public.user_profiles
    SET api_key_group = current_key_group
    WHERE id = user_record.id;

    user_count := user_count + 1;

    -- Move to next key group (round-robin)
    current_key_group := current_key_group + 1;
    IF current_key_group > max_key_group THEN
      current_key_group := 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Redistributed % users across % key groups', user_count, max_key_group;
END $$;

-- Step 3: Rebuild api_key_stats table with ALL 31 key groups
-- First, insert placeholder rows for ALL 31 keys (even if no users assigned yet)
DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..31 LOOP
    INSERT INTO public.api_key_stats (key_group, user_count, total_requests, total_tokens)
    VALUES (i, 0, 0, 0)
    ON CONFLICT (key_group) DO NOTHING;
  END LOOP;
END $$;

-- Step 4: Update user counts for each key group
INSERT INTO public.api_key_stats (key_group, user_count)
SELECT api_key_group, COUNT(*)
FROM public.user_profiles
GROUP BY api_key_group
ON CONFLICT (key_group) DO UPDATE
SET user_count = EXCLUDED.user_count;

-- Step 5: Verify the distribution
SELECT
  api_key_group,
  user_count,
  ROUND(user_count * 100.0 / (SELECT COUNT(*) FROM public.user_profiles), 2) as percentage
FROM public.api_key_stats
ORDER BY api_key_group;

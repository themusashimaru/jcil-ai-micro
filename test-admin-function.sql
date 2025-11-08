-- ============================================
-- DIAGNOSTIC TEST FOR get_all_users_for_admin
-- ============================================
-- Run this in Supabase SQL Editor to verify the function works

-- TEST 1: Check if function exists
SELECT
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'get_all_users_for_admin';

-- TEST 2: Try calling the function
DO $$
DECLARE
  v_count INTEGER;
  v_sample RECORD;
BEGIN
  -- Count how many users the function returns
  SELECT COUNT(*) INTO v_count FROM get_all_users_for_admin();
  RAISE NOTICE '✅ Function returned % users', v_count;

  -- Get a sample user
  SELECT * INTO v_sample FROM get_all_users_for_admin() LIMIT 1;

  IF v_sample IS NOT NULL THEN
    RAISE NOTICE '✅ Sample user data:';
    RAISE NOTICE '   - ID: %', v_sample.id;
    RAISE NOTICE '   - Email: %', v_sample.email;
    RAISE NOTICE '   - Tier: %', v_sample.subscription_tier;
    RAISE NOTICE '   - Daily messages: %', v_sample.daily_message_count;
    RAISE NOTICE '   - Daily limit: %', v_sample.daily_message_limit;
  ELSE
    RAISE NOTICE '⚠️  No users found in database';
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR calling function: %', SQLERRM;
    RAISE NOTICE '   Error detail: %', SQLSTATE;
END $$;

-- TEST 3: Check table structure
SELECT
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('user_profiles', 'daily_usage')
  AND column_name IN ('subscription_tier', 'daily_message_limit', 'message_count', 'token_count', 'usage_date')
ORDER BY table_name, column_name;

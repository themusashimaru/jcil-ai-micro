-- ============================================
-- COMPREHENSIVE FIX FOR ADMIN FUNCTION
-- ============================================
-- This script will completely reset and recreate the function
-- Run this in Supabase SQL Editor

-- STEP 1: Drop all existing versions of the function
DROP FUNCTION IF EXISTS public.get_all_users_for_admin() CASCADE;

-- STEP 2: Create the function with correct types
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE(
  id UUID,
  email TEXT,
  subscription_tier TEXT,
  daily_message_count INTEGER,
  daily_message_limit INTEGER,
  daily_token_count INTEGER,
  last_active TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id::UUID,
    COALESCE(u.email, '')::TEXT as email,
    COALESCE(p.subscription_tier, 'free')::TEXT as subscription_tier,
    COALESCE(du.message_count, 0)::INTEGER as daily_message_count,
    COALESCE(p.daily_message_limit, 10)::INTEGER as daily_message_limit,
    COALESCE(du.token_count, 0)::INTEGER as daily_token_count,
    COALESCE(du.updated_at, p.updated_at, u.created_at)::TIMESTAMP WITH TIME ZONE as last_active,
    u.created_at::TIMESTAMP WITH TIME ZONE
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON u.id = p.id
  LEFT JOIN public.daily_usage du ON u.id = du.user_id AND du.usage_date = CURRENT_DATE
  ORDER BY COALESCE(p.updated_at, u.created_at) DESC NULLS LAST;
END;
$$;

-- STEP 3: Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO anon;

-- STEP 4: Force schema reload
NOTIFY pgrst, 'reload schema';

-- STEP 5: Test the function
DO $$
DECLARE
  v_count INTEGER;
  v_test RECORD;
BEGIN
  -- Test if function works
  SELECT COUNT(*) INTO v_count FROM public.get_all_users_for_admin();

  IF v_count > 0 THEN
    RAISE NOTICE '✅ SUCCESS! Function works and returned % users', v_count;

    -- Show sample data
    SELECT * INTO v_test FROM public.get_all_users_for_admin() LIMIT 1;
    RAISE NOTICE '📊 Sample data:';
    RAISE NOTICE '   Email: %', v_test.email;
    RAISE NOTICE '   Tier: %', v_test.subscription_tier;
    RAISE NOTICE '   Messages today: % / %', v_test.daily_message_count, v_test.daily_message_limit;
  ELSE
    RAISE NOTICE '⚠️  Function works but no users found in database';
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '❌ Function test FAILED: % (SQL State: %)', SQLERRM, SQLSTATE;
END $$;

-- STEP 6: Verify permissions
SELECT
  routine_name,
  routine_type,
  security_type,
  routine_definition IS NOT NULL as has_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_all_users_for_admin';

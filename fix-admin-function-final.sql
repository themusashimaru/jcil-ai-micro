-- Drop and recreate admin function with explicit type casting
DROP FUNCTION IF EXISTS public.get_all_users_for_admin() CASCADE;

-- Create the function
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(p.subscription_tier, 'free')::TEXT as subscription_tier,
    COALESCE(du.message_count, 0)::INTEGER as daily_message_count,
    COALESCE(p.daily_message_limit, 10)::INTEGER as daily_message_limit,
    COALESCE(du.token_count, 0)::INTEGER as daily_token_count,
    COALESCE(du.updated_at, p.updated_at, u.created_at) as last_active,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON u.id = p.id
  LEFT JOIN public.daily_usage du ON u.id = du.user_id AND du.usage_date = CURRENT_DATE
  ORDER BY p.updated_at DESC NULLS LAST;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Test the function
DO $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT * FROM public.get_all_users_for_admin() LIMIT 1 INTO v_result;
  RAISE NOTICE '✅ Function created and tested successfully!';
  RAISE NOTICE '📊 Function is ready to use';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error testing function: %', SQLERRM;
END $$;

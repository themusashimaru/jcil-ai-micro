-- ============================================
-- ADMIN USER MANAGEMENT FUNCTION
-- ============================================
-- This creates a secure function to fetch all users with their emails

-- Function to get all users with their details for admin panel
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
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    COALESCE(p.subscription_tier, 'free') as subscription_tier,
    COALESCE(du.message_count, 0) as daily_message_count,
    COALESCE(p.daily_message_limit, 10) as daily_message_limit,
    COALESCE(du.token_count, 0) as daily_token_count,
    COALESCE(du.updated_at, p.updated_at, u.created_at) as last_active,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON u.id = p.id
  LEFT JOIN public.daily_usage du ON u.id = du.user_id AND du.usage_date = CURRENT_DATE
  ORDER BY p.updated_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (will be restricted by API)
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Admin user management function created successfully!';
  RAISE NOTICE '📊 Use /api/admin/users to fetch user list';
END $$;

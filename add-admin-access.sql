-- ============================================
-- ADD ADMIN ACCESS CONTROL
-- ============================================
-- This adds an admin flag to user_profiles and makes you the admin

-- Add admin column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create index for faster admin checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin
ON public.user_profiles(is_admin)
WHERE is_admin = TRUE;

-- Set m.moser338@gmail.com as admin
UPDATE public.user_profiles
SET is_admin = TRUE
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'm.moser338@gmail.com'
);

-- Verify admin was set
SELECT
  u.email,
  p.is_admin,
  p.subscription_tier
FROM auth.users u
JOIN public.user_profiles p ON u.id = p.id
WHERE p.is_admin = TRUE;

-- ============================================
-- ADMIN ANALYTICS HELPER FUNCTIONS
-- ============================================

-- Function to get revenue by tier
CREATE OR REPLACE FUNCTION public.get_revenue_by_tier(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  tier TEXT,
  user_count BIGINT,
  monthly_price NUMERIC,
  monthly_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    subscription_tier as tier,
    COUNT(*) as user_count,
    COALESCE(MAX(up.monthly_price), 0) as monthly_price,
    COUNT(*) * COALESCE(MAX(up.monthly_price), 0) as monthly_revenue
  FROM public.user_profiles up
  WHERE subscription_tier IS NOT NULL
  GROUP BY subscription_tier
  ORDER BY monthly_price DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get token usage stats
CREATE OR REPLACE FUNCTION public.get_token_usage_stats(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  usage_date DATE,
  total_messages BIGINT,
  total_tokens BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    du.usage_date,
    SUM(du.message_count) as total_messages,
    SUM(du.token_count) as total_tokens
  FROM public.daily_usage du
  WHERE du.usage_date BETWEEN p_start_date AND p_end_date
  GROUP BY du.usage_date
  ORDER BY du.usage_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user signups over time
CREATE OR REPLACE FUNCTION public.get_signup_stats(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  signup_date DATE,
  signup_count BIGINT,
  tier TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(u.created_at) as signup_date,
    COUNT(*) as signup_count,
    COALESCE(p.subscription_tier, 'free') as tier
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON u.id = p.id
  WHERE DATE(u.created_at) BETWEEN p_start_date AND p_end_date
  GROUP BY DATE(u.created_at), p.subscription_tier
  ORDER BY signup_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Admin access configured successfully!';
  RAISE NOTICE '📧 Admin user: m.moser338@gmail.com';
  RAISE NOTICE '🔒 Admin dashboard will be available at /admin';
END $$;

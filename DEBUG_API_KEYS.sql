-- ============================================
-- DIAGNOSTIC QUERIES FOR API KEY LOAD BALANCING
-- ============================================
-- Run these in Supabase SQL Editor to see what's happening

-- 1. CHECK: How many users have api_key_group assigned?
SELECT
  'Total Users' as metric,
  COUNT(*) as count
FROM public.user_profiles;

-- 2. CHECK: Distribution of users across key groups
SELECT
  api_key_group,
  COUNT(*) as user_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM public.user_profiles), 2) as percentage
FROM public.user_profiles
GROUP BY api_key_group
ORDER BY api_key_group;

-- 3. CHECK: What's in the api_key_stats table?
SELECT * FROM public.api_key_stats
ORDER BY key_group;

-- 4. CHECK: Any users with NULL api_key_group?
SELECT COUNT(*) as users_without_key_group
FROM public.user_profiles
WHERE api_key_group IS NULL;

-- 5. CHECK: Min and max key groups
SELECT
  MIN(api_key_group) as min_key_group,
  MAX(api_key_group) as max_key_group,
  COUNT(DISTINCT api_key_group) as unique_key_groups
FROM public.user_profiles;

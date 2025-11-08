-- ============================================================================
-- SUPABASE QUICK AUDIT - Easy to Read Overview
-- Run this for a fast summary of your database state
-- ============================================================================

-- ============================================================================
-- OVERVIEW DASHBOARD
-- ============================================================================

SELECT
    '=== DATABASE OVERVIEW ===' as info;

-- Total counts
SELECT
    'TOTAL USERS' as metric,
    count(*)::text as value
FROM user_profiles
UNION ALL
SELECT
    'TOTAL MESSAGES' as metric,
    count(*)::text as value
FROM messages
UNION ALL
SELECT
    'TOTAL CONVERSATIONS' as metric,
    count(*)::text as value
FROM conversations
UNION ALL
SELECT
    'TOTAL DEVOTIONALS' as metric,
    count(*)::text as value
FROM daily_devotionals
UNION ALL
SELECT
    'DATABASE SIZE' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value;

-- ============================================================================
-- USER BREAKDOWN BY TIER
-- ============================================================================

SELECT
    '=== USERS BY SUBSCRIPTION TIER ===' as info;

SELECT
    subscription_tier,
    count(*) as users,
    sum(monthly_price)::money as monthly_revenue,
    avg(daily_message_limit)::integer as avg_msg_limit
FROM user_profiles
GROUP BY subscription_tier
ORDER BY
    CASE subscription_tier
        WHEN 'free' THEN 1
        WHEN 'basic' THEN 2
        WHEN 'pro' THEN 3
        WHEN 'premium' THEN 4
        WHEN 'executive' THEN 5
    END;

-- ============================================================================
-- STRIPE SUBSCRIPTION STATUS
-- ============================================================================

SELECT
    '=== STRIPE SUBSCRIPTION STATUS ===' as info;

SELECT
    COALESCE(subscription_status, 'no_stripe') as status,
    count(*) as users,
    sum(monthly_price)::money as mrr
FROM user_profiles
GROUP BY subscription_status
ORDER BY count(*) DESC;

-- ============================================================================
-- ACTIVITY LAST 7 DAYS
-- ============================================================================

SELECT
    '=== ACTIVITY LAST 7 DAYS ===' as info;

SELECT
    usage_date,
    count(DISTINCT user_id) as active_users,
    sum(message_count) as messages,
    sum(token_count) as tokens,
    round(avg(message_count), 2) as avg_msg_per_user
FROM daily_usage
WHERE usage_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY usage_date
ORDER BY usage_date DESC;

-- ============================================================================
-- TOP 10 MOST ACTIVE USERS
-- ============================================================================

SELECT
    '=== TOP 10 MOST ACTIVE USERS ===' as info;

SELECT
    u.subscription_tier,
    count(m.id) as total_messages,
    count(DISTINCT m.conversation_id) as conversations,
    max(m.created_at)::date as last_active
FROM user_profiles u
LEFT JOIN messages m ON m.user_id = u.id
GROUP BY u.id, u.subscription_tier
ORDER BY total_messages DESC
LIMIT 10;

-- ============================================================================
-- RECENT SIGNUPS (Last 30 days)
-- ============================================================================

SELECT
    '=== NEW USERS LAST 30 DAYS ===' as info;

SELECT
    created_at::date as signup_date,
    count(*) as new_users
FROM user_profiles
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY created_at::date
ORDER BY signup_date DESC;

-- ============================================================================
-- TABLE SIZES
-- ============================================================================

SELECT
    '=== TABLE STORAGE SIZES ===' as info;

SELECT
    tablename as table_name,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as total_size,
    (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tablename) as columns
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- ============================================================================
-- RLS STATUS (Should all be TRUE)
-- ============================================================================

SELECT
    '=== ROW LEVEL SECURITY STATUS ===' as info;

SELECT
    tablename as table_name,
    rowsecurity as rls_enabled,
    CASE WHEN rowsecurity THEN '✓' ELSE '✗ ISSUE!' END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- ADMIN USERS
-- ============================================================================

SELECT
    '=== ADMIN USERS ===' as info;

SELECT
    id,
    subscription_tier,
    created_at::date as joined,
    updated_at::date as last_update
FROM user_profiles
WHERE is_admin = true;

-- ============================================================================
-- RECENT MODERATION LOGS (Issues)
-- ============================================================================

SELECT
    '=== RECENT MODERATION ISSUES ===' as info;

SELECT
    created_at::date as date,
    categories,
    reason,
    count(*) as occurrences
FROM moderation_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY created_at::date, categories, reason
ORDER BY created_at DESC;

-- ============================================================================
-- DATA INTEGRITY CHECK
-- ============================================================================

SELECT
    '=== DATA INTEGRITY CHECKS ===' as info;

SELECT
    'Orphaned Messages' as check_name,
    count(*) as issues,
    CASE WHEN count(*) = 0 THEN '✓ OK' ELSE '✗ NEEDS FIX' END as status
FROM messages m
LEFT JOIN user_profiles u ON m.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT
    'Orphaned Conversations' as check_name,
    count(*) as issues,
    CASE WHEN count(*) = 0 THEN '✓ OK' ELSE '✗ NEEDS FIX' END as status
FROM conversations c
LEFT JOIN user_profiles u ON c.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT
    'Users without tier' as check_name,
    count(*) as issues,
    CASE WHEN count(*) = 0 THEN '✓ OK' ELSE '✗ NEEDS FIX' END as status
FROM user_profiles
WHERE subscription_tier IS NULL OR subscription_tier = ''

UNION ALL

SELECT
    'Users with negative limits' as check_name,
    count(*) as issues,
    CASE WHEN count(*) = 0 THEN '✓ OK' ELSE '✗ NEEDS FIX' END as status
FROM user_profiles
WHERE daily_message_limit < 0;

-- ============================================================================
-- DAILY DEVOTIONAL STATUS
-- ============================================================================

SELECT
    '=== DAILY DEVOTIONAL STATUS ===' as info;

SELECT
    date_key,
    generated_at,
    length(content) as content_length,
    CASE
        WHEN date_key = to_char(CURRENT_DATE, 'YYYY-MM-DD') THEN '✓ Today'
        ELSE 'Past'
    END as status
FROM daily_devotionals
ORDER BY date_key DESC
LIMIT 7;

-- ============================================================================
-- REVENUE SUMMARY
-- ============================================================================

SELECT
    '=== REVENUE SUMMARY ===' as info;

SELECT
    'Total MRR' as metric,
    sum(monthly_price)::money as value
FROM user_profiles
WHERE subscription_status = 'active'

UNION ALL

SELECT
    'Potential MRR (all tiers)' as metric,
    sum(monthly_price)::money as value
FROM user_profiles
WHERE subscription_tier != 'free'

UNION ALL

SELECT
    'Average Revenue Per User' as metric,
    (sum(monthly_price) / NULLIF(count(*), 0))::money as value
FROM user_profiles
WHERE monthly_price > 0;

-- ============================================================================
-- SUMMARY STATS
-- ============================================================================

SELECT
    '=== QUICK SUMMARY ===' as info;

SELECT
    (SELECT count(*) FROM user_profiles) as total_users,
    (SELECT count(*) FROM user_profiles WHERE subscription_tier != 'free') as paid_users,
    (SELECT count(*) FROM user_profiles WHERE is_admin = true) as admins,
    (SELECT count(*) FROM messages) as total_messages,
    (SELECT count(*) FROM conversations) as total_conversations,
    (SELECT pg_size_pretty(pg_database_size(current_database()))) as db_size,
    (SELECT sum(monthly_price)::money FROM user_profiles WHERE subscription_status = 'active') as active_mrr;

-- ============================================================================
-- SUPABASE DATABASE COMPREHENSIVE AUDIT
-- Run this in Supabase SQL Editor to see everything about your database
-- ============================================================================

-- ============================================================================
-- 1. ALL TABLES WITH ROW COUNTS
-- ============================================================================
SELECT
    schemaname as schema,
    tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    (SELECT count(*) FROM information_schema.columns WHERE table_schema = schemaname AND table_name = tablename) as column_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 2. ROW COUNTS FOR ALL TABLES
-- ============================================================================
DO $$
DECLARE
    table_record RECORD;
    row_count INTEGER;
BEGIN
    RAISE NOTICE '=== TABLE ROW COUNTS ===';
    FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        EXECUTE format('SELECT count(*) FROM %I', table_record.tablename) INTO row_count;
        RAISE NOTICE 'Table: % | Rows: %', table_record.tablename, row_count;
    END LOOP;
END $$;

-- ============================================================================
-- 3. ALL COLUMNS WITH DATA TYPES
-- ============================================================================
SELECT
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- 4. ALL INDEXES
-- ============================================================================
SELECT
    schemaname as schema,
    tablename as table_name,
    indexname as index_name,
    indexdef as index_definition
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- 5. ALL FOREIGN KEYS
-- ============================================================================
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================================================
-- 6. ALL UNIQUE CONSTRAINTS
-- ============================================================================
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================================
-- 7. ALL RLS (ROW LEVEL SECURITY) POLICIES
-- ============================================================================
SELECT
    schemaname as schema,
    tablename as table_name,
    policyname as policy_name,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- 8. RLS ENABLED STATUS
-- ============================================================================
SELECT
    schemaname as schema,
    tablename as table_name,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 9. ALL CUSTOM FUNCTIONS
-- ============================================================================
SELECT
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prokind = 'f'  -- 'f' for function
ORDER BY p.proname;

-- ============================================================================
-- 10. ALL TRIGGERS
-- ============================================================================
SELECT
    event_object_schema as schema,
    event_object_table as table_name,
    trigger_name,
    event_manipulation as event,
    action_timing as timing,
    action_statement as action
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 11. TABLE SIZES (DETAILED)
-- ============================================================================
SELECT
    schemaname as schema,
    tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- 12. SAMPLE DATA FROM EACH TABLE (First 3 rows)
-- ============================================================================

-- user_profiles sample
SELECT 'user_profiles' as table_name, count(*) as total_rows FROM user_profiles;
SELECT * FROM user_profiles ORDER BY created_at DESC LIMIT 3;

-- conversations sample
SELECT 'conversations' as table_name, count(*) as total_rows FROM conversations;
SELECT * FROM conversations ORDER BY created_at DESC LIMIT 3;

-- messages sample
SELECT 'messages' as table_name, count(*) as total_rows FROM messages;
SELECT id, user_id, conversation_id, role, substring(content, 1, 100) as content_preview, created_at
FROM messages ORDER BY created_at DESC LIMIT 3;

-- daily_usage sample
SELECT 'daily_usage' as table_name, count(*) as total_rows FROM daily_usage;
SELECT * FROM daily_usage ORDER BY usage_date DESC LIMIT 3;

-- notifications sample
SELECT 'notifications' as table_name, count(*) as total_rows FROM notifications;
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 3;

-- daily_devotionals sample
SELECT 'daily_devotionals' as table_name, count(*) as total_rows FROM daily_devotionals;
SELECT id, date_key, substring(content, 1, 100) as content_preview, generated_at
FROM daily_devotionals ORDER BY created_at DESC LIMIT 3;

-- daily_news_summaries sample
SELECT 'daily_news_summaries' as table_name, count(*) as total_rows FROM daily_news_summaries;
SELECT * FROM daily_news_summaries ORDER BY created_at DESC LIMIT 3;

-- moderation_logs sample
SELECT 'moderation_logs' as table_name, count(*) as total_rows FROM moderation_logs;
SELECT user_id, ip, categories, reason, substring(tip, 1, 50) as tip_preview, created_at
FROM moderation_logs ORDER BY created_at DESC LIMIT 3;

-- upgrade_prompts sample
SELECT 'upgrade_prompts' as table_name, count(*) as total_rows FROM upgrade_prompts;
SELECT * FROM upgrade_prompts ORDER BY shown_at DESC LIMIT 3;

-- ============================================================================
-- 13. USER STATISTICS
-- ============================================================================
SELECT
    subscription_tier,
    count(*) as user_count,
    avg(daily_message_limit) as avg_message_limit,
    sum(monthly_price) as total_monthly_revenue
FROM user_profiles
GROUP BY subscription_tier
ORDER BY subscription_tier;

-- ============================================================================
-- 14. USAGE STATISTICS (Last 30 Days)
-- ============================================================================
SELECT
    usage_date,
    count(DISTINCT user_id) as active_users,
    sum(message_count) as total_messages,
    sum(token_count) as total_tokens,
    avg(message_count) as avg_messages_per_user
FROM daily_usage
WHERE usage_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY usage_date
ORDER BY usage_date DESC
LIMIT 30;

-- ============================================================================
-- 15. CONVERSATION STATISTICS
-- ============================================================================
SELECT
    count(*) as total_conversations,
    count(DISTINCT user_id) as users_with_conversations,
    avg(message_count) as avg_messages_per_conversation
FROM (
    SELECT
        conversation_id,
        user_id,
        count(*) as message_count
    FROM messages
    GROUP BY conversation_id, user_id
) as conv_stats;

-- ============================================================================
-- 16. RECENT ACTIVITY (Last 24 Hours)
-- ============================================================================
SELECT
    'Messages' as activity_type,
    count(*) as count_24h
FROM messages
WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'New Users' as activity_type,
    count(*) as count_24h
FROM user_profiles
WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'New Conversations' as activity_type,
    count(*) as count_24h
FROM conversations
WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'Notifications Sent' as activity_type,
    count(*) as count_24h
FROM notifications
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- ============================================================================
-- 17. STRIPE SUBSCRIPTION STATUS
-- ============================================================================
SELECT
    subscription_status,
    count(*) as user_count,
    sum(monthly_price) as total_mrr
FROM user_profiles
WHERE stripe_subscription_id IS NOT NULL
GROUP BY subscription_status
ORDER BY subscription_status;

-- ============================================================================
-- 18. TOP USERS BY MESSAGE COUNT (All Time)
-- ============================================================================
SELECT
    u.id,
    u.subscription_tier,
    count(m.id) as total_messages,
    min(m.created_at) as first_message,
    max(m.created_at) as last_message
FROM user_profiles u
LEFT JOIN messages m ON m.user_id = u.id
GROUP BY u.id, u.subscription_tier
ORDER BY total_messages DESC
LIMIT 10;

-- ============================================================================
-- 19. ADMIN USERS
-- ============================================================================
SELECT
    id,
    subscription_tier,
    is_admin,
    created_at
FROM user_profiles
WHERE is_admin = true
ORDER BY created_at;

-- ============================================================================
-- 20. ORPHANED DATA CHECK
-- ============================================================================

-- Messages without users (should be 0)
SELECT 'Messages without users' as issue, count(*) as count
FROM messages m
LEFT JOIN user_profiles u ON m.user_id = u.id
WHERE u.id IS NULL;

-- Conversations without users (should be 0)
SELECT 'Conversations without users' as issue, count(*) as count
FROM conversations c
LEFT JOIN user_profiles u ON c.user_id = u.id
WHERE u.id IS NULL;

-- Messages without conversations (should be 0)
SELECT 'Messages without conversations' as issue, count(*) as count
FROM messages m
LEFT JOIN conversations c ON m.conversation_id = c.id
WHERE c.id IS NULL;

-- ============================================================================
-- 21. STORAGE USAGE SUMMARY
-- ============================================================================
SELECT
    'Total Database Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value
UNION ALL
SELECT
    'Public Schema Size' as metric,
    pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint) as value
FROM pg_tables
WHERE schemaname = 'public';

-- ============================================================================
-- 22. FUNCTION EXECUTION TEST (Check if functions work)
-- ============================================================================

-- Test get_revenue_by_tier
SELECT * FROM get_revenue_by_tier(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE
);

-- Test get_token_usage_stats
SELECT * FROM get_token_usage_stats(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE
);

-- Test get_signup_stats
SELECT * FROM get_signup_stats(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE
);

-- ============================================================================
-- END OF AUDIT
-- ============================================================================

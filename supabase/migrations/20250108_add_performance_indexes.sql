-- ============================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- ============================================================
-- Purpose: Additional composite indexes for common query patterns
-- Improves admin dashboard and API route performance
-- Date: 2025-01-08
-- ============================================================

-- ============================================================
-- 1. USERS TABLE - Composite indexes for admin dashboard stats
-- ============================================================

-- Index for filtering active users by tier (admin users list)
CREATE INDEX IF NOT EXISTS idx_users_tier_status
    ON public.users(subscription_tier, subscription_status)
    WHERE deleted_at IS NULL AND is_active = true;

-- Index for active users queries (last N days)
CREATE INDEX IF NOT EXISTS idx_users_last_message_date
    ON public.users(last_message_date DESC NULLS LAST)
    WHERE deleted_at IS NULL;

-- Partial index for active users only (most queries filter deleted/inactive)
CREATE INDEX IF NOT EXISTS idx_users_active_created
    ON public.users(created_at DESC)
    WHERE deleted_at IS NULL AND is_active = true;

-- ============================================================
-- 2. CONVERSATIONS TABLE - Optimized for user queries
-- ============================================================

-- Composite index for user's recent conversations (sidebar list)
CREATE INDEX IF NOT EXISTS idx_conversations_user_recent
    ON public.conversations(user_id, updated_at DESC)
    WHERE deleted_at IS NULL;

-- Index for conversation history with folder support
CREATE INDEX IF NOT EXISTS idx_conversations_user_folder
    ON public.conversations(user_id, folder_id, updated_at DESC)
    WHERE deleted_at IS NULL;

-- ============================================================
-- 3. MESSAGES TABLE - Optimized for conversation view
-- ============================================================

-- Composite index for message pagination (most common query)
CREATE INDEX IF NOT EXISTS idx_messages_conv_created_desc
    ON public.messages(conversation_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- Index for counting messages by role (AI vs user)
CREATE INDEX IF NOT EXISTS idx_messages_role_conv
    ON public.messages(conversation_id, role)
    WHERE deleted_at IS NULL;

-- ============================================================
-- 4. SUPPORT TICKETS - Admin inbox optimization
-- ============================================================

-- Composite index for filtered inbox view
CREATE INDEX IF NOT EXISTS idx_support_tickets_inbox
    ON public.support_tickets(status, is_archived, created_at DESC)
    WHERE is_archived = false;

-- Index for unread tickets (badge count)
CREATE INDEX IF NOT EXISTS idx_support_tickets_unread
    ON public.support_tickets(is_read, created_at DESC)
    WHERE is_archived = false AND is_read = false;

-- ============================================================
-- 5. CODE LAB TABLES - Session and message optimization
-- ============================================================

-- Recent sessions by user (sidebar listing)
CREATE INDEX IF NOT EXISTS idx_code_lab_sessions_user_recent
    ON public.code_lab_sessions(user_id, updated_at DESC);

-- Messages by session with type filter (common UI pattern)
CREATE INDEX IF NOT EXISTS idx_code_lab_messages_session_type_created
    ON public.code_lab_messages(session_id, type, created_at DESC);

-- ============================================================
-- 6. RATE LIMITS - Optimized for quick lookups
-- ============================================================

-- Composite index for rate limit checks
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
    ON public.rate_limits(identifier, action, created_at DESC);

-- ============================================================
-- 7. ADMIN ACTIVITY LOGS - For audit queries
-- ============================================================

-- Index for admin activity timeline
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_recent
    ON public.admin_activity_logs(admin_user_id, created_at DESC);

-- Index for user activity audit trail
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_recent
    ON public.admin_activity_logs(target_user_id, created_at DESC)
    WHERE target_user_id IS NOT NULL;

-- ============================================================
-- 8. TOOL USAGE - Analytics optimization
-- ============================================================

-- Index for tool usage analytics by date range
CREATE INDEX IF NOT EXISTS idx_tool_usage_date_tool
    ON public.tool_usage(created_at DESC, tool_name)
    WHERE deleted_at IS NULL;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'PERFORMANCE INDEXES INSTALLED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Added composite indexes for:';
    RAISE NOTICE '  - User filtering and active user queries';
    RAISE NOTICE '  - Conversation listing and history';
    RAISE NOTICE '  - Message pagination and filtering';
    RAISE NOTICE '  - Support ticket inbox views';
    RAISE NOTICE '  - Code Lab session management';
    RAISE NOTICE '  - Rate limit lookups';
    RAISE NOTICE '  - Admin activity auditing';
    RAISE NOTICE '  - Tool usage analytics';
    RAISE NOTICE '============================================================';
END $$;

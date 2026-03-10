-- ============================================================
-- FIX: EXTEND RETENTION FOR ALL EXISTING CONVERSATIONS
-- ============================================================
-- Problem: Conversations were created with 30-day retention_until,
-- causing them to be soft-deleted by the delete_expired_data() cron.
-- This fix extends all active conversations to 1 year from now,
-- and recovers any recently soft-deleted conversations.
--
-- Run this in the Supabase SQL Editor immediately.
-- ============================================================

-- 1. Extend retention for ALL active conversations to 1 year from now
UPDATE public.conversations
SET retention_until = NOW() + INTERVAL '1 year'
WHERE deleted_at IS NULL;

-- 2. Recover recently soft-deleted conversations (deleted by expired retention)
-- These are conversations that were NOT user-deleted but cron-deleted
UPDATE public.conversations
SET
    deleted_at = NULL,
    retention_until = NOW() + INTERVAL '1 year'
WHERE deleted_at IS NOT NULL
  AND deleted_at > NOW() - INTERVAL '90 days';

-- 3. Recover messages for those recovered conversations
UPDATE public.messages
SET
    deleted_at = NULL,
    retention_until = NOW() + INTERVAL '1 year'
WHERE conversation_id IN (
    SELECT id FROM public.conversations WHERE deleted_at IS NULL
)
AND deleted_at IS NOT NULL
AND deleted_at > NOW() - INTERVAL '90 days';

-- 4. Extend retention for ALL active messages
UPDATE public.messages
SET retention_until = NOW() + INTERVAL '1 year'
WHERE deleted_at IS NULL
  AND retention_until < NOW() + INTERVAL '6 months';

-- 5. Update the delete_expired_data function to use 1-year soft-delete window
CREATE OR REPLACE FUNCTION delete_expired_data()
RETURNS void AS $$
DECLARE
    soft_deleted_count INTEGER := 0;
    hard_deleted_conversations INTEGER := 0;
    hard_deleted_messages INTEGER := 0;
    hard_deleted_uploads INTEGER := 0;
    hard_deleted_tool_usage INTEGER := 0;
    hard_deleted_moderation INTEGER := 0;
BEGIN
    -- ============================================================
    -- STAGE 1: SOFT DELETE (retention_until expired)
    -- ============================================================
    -- Only soft-delete data whose retention_until has passed
    -- (Now set to 1 year from creation/last activity)

    UPDATE public.conversations
    SET deleted_at = NOW()
    WHERE retention_until < NOW()
    AND deleted_at IS NULL;

    GET DIAGNOSTICS soft_deleted_count = ROW_COUNT;

    UPDATE public.messages
    SET deleted_at = NOW()
    WHERE retention_until < NOW()
    AND deleted_at IS NULL;

    UPDATE public.uploads
    SET deleted_at = NOW()
    WHERE retention_until < NOW()
    AND deleted_at IS NULL;

    UPDATE public.tool_usage
    SET deleted_at = NOW()
    WHERE retention_until < NOW()
    AND deleted_at IS NULL;

    -- ============================================================
    -- STAGE 2: HARD DELETE (6 months after soft delete)
    -- ============================================================
    DELETE FROM public.conversations
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '6 months';

    GET DIAGNOSTICS hard_deleted_conversations = ROW_COUNT;

    DELETE FROM public.messages
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '6 months';

    GET DIAGNOSTICS hard_deleted_messages = ROW_COUNT;

    DELETE FROM public.uploads
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '6 months';

    GET DIAGNOSTICS hard_deleted_uploads = ROW_COUNT;

    DELETE FROM public.tool_usage
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '6 months';

    GET DIAGNOSTICS hard_deleted_tool_usage = ROW_COUNT;

    DELETE FROM public.moderation_logs
    WHERE retention_until < NOW();

    GET DIAGNOSTICS hard_deleted_moderation = ROW_COUNT;

    RAISE NOTICE 'Retention cleanup: soft-deleted=%, hard-deleted conv=% msg=% uploads=% tools=% mod=%',
        soft_deleted_count, hard_deleted_conversations, hard_deleted_messages,
        hard_deleted_uploads, hard_deleted_tool_usage, hard_deleted_moderation;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Check how many conversations were affected
SELECT
    COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_conversations,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as soft_deleted_conversations,
    MIN(retention_until) FILTER (WHERE deleted_at IS NULL) as earliest_retention,
    MAX(retention_until) FILTER (WHERE deleted_at IS NULL) as latest_retention
FROM public.conversations;

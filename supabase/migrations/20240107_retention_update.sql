-- ============================================================
-- UPDATED DATA RETENTION POLICY
-- ============================================================
-- Purpose: Two-stage deletion for data retention
-- - SOFT DELETE at 3 months: Data hidden but recoverable
-- - HARD DELETE at 6 months: Data permanently removed
-- ============================================================

-- Update the delete_expired_data function
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
    -- STAGE 1: SOFT DELETE (3 MONTHS OLD)
    -- ============================================================
    -- Data becomes invisible but recoverable

    -- Soft delete expired conversations
    UPDATE public.conversations
    SET deleted_at = NOW()
    WHERE retention_until < NOW()
    AND deleted_at IS NULL;

    GET DIAGNOSTICS soft_deleted_count = ROW_COUNT;

    -- Soft delete expired messages
    UPDATE public.messages
    SET deleted_at = NOW()
    WHERE retention_until < NOW()
    AND deleted_at IS NULL;

    -- Soft delete expired uploads
    UPDATE public.uploads
    SET deleted_at = NOW()
    WHERE retention_until < NOW()
    AND deleted_at IS NULL;

    -- Soft delete expired tool usage
    UPDATE public.tool_usage
    SET deleted_at = NOW()
    WHERE retention_until < NOW()
    AND deleted_at IS NULL;

    -- ============================================================
    -- STAGE 2: HARD DELETE (6 MONTHS OLD - 3 months after soft delete)
    -- ============================================================
    -- Permanently remove data that's been soft-deleted for 3+ months

    -- Hard delete conversations soft-deleted 3+ months ago
    DELETE FROM public.conversations
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '3 months';

    GET DIAGNOSTICS hard_deleted_conversations = ROW_COUNT;

    -- Hard delete messages soft-deleted 3+ months ago
    DELETE FROM public.messages
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '3 months';

    GET DIAGNOSTICS hard_deleted_messages = ROW_COUNT;

    -- Hard delete uploads soft-deleted 3+ months ago
    DELETE FROM public.uploads
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '3 months';

    GET DIAGNOSTICS hard_deleted_uploads = ROW_COUNT;

    -- Hard delete tool usage soft-deleted 3+ months ago
    DELETE FROM public.tool_usage
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '3 months';

    GET DIAGNOSTICS hard_deleted_tool_usage = ROW_COUNT;

    -- Hard delete moderation logs (3 months, no soft delete needed)
    DELETE FROM public.moderation_logs
    WHERE retention_until < NOW();

    GET DIAGNOSTICS hard_deleted_moderation = ROW_COUNT;

    -- ============================================================
    -- LOG RESULTS
    -- ============================================================
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'DATA RETENTION CLEANUP COMPLETED';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Soft deleted (3 months): % items', soft_deleted_count;
    RAISE NOTICE 'Hard deleted conversations (6 months): %', hard_deleted_conversations;
    RAISE NOTICE 'Hard deleted messages (6 months): %', hard_deleted_messages;
    RAISE NOTICE 'Hard deleted uploads (6 months): %', hard_deleted_uploads;
    RAISE NOTICE 'Hard deleted tool usage (6 months): %', hard_deleted_tool_usage;
    RAISE NOTICE 'Hard deleted moderation logs (3 months): %', hard_deleted_moderation;
    RAISE NOTICE '============================================================';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- OPTIONAL: MANUAL RECOVERY FUNCTION
-- ============================================================
-- Allows admin to recover soft-deleted data if needed

CREATE OR REPLACE FUNCTION recover_soft_deleted_conversation(conversation_uuid UUID)
RETURNS void AS $$
BEGIN
    -- Recover conversation
    UPDATE public.conversations
    SET
        deleted_at = NULL,
        retention_until = NOW() + INTERVAL '3 months'
    WHERE id = conversation_uuid;

    -- Recover associated messages
    UPDATE public.messages
    SET
        deleted_at = NULL,
        retention_until = NOW() + INTERVAL '3 months'
    WHERE conversation_id = conversation_uuid;

    -- Recover associated uploads
    UPDATE public.uploads
    SET
        deleted_at = NULL,
        retention_until = NOW() + INTERVAL '3 months'
    WHERE conversation_id = conversation_uuid;

    RAISE NOTICE 'Conversation % and associated data recovered', conversation_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STORAGE BUCKET CLEANUP FUNCTION
-- ============================================================
-- Delete files from storage when uploads are hard-deleted

CREATE OR REPLACE FUNCTION cleanup_storage_files()
RETURNS void AS $$
DECLARE
    upload_record RECORD;
    deleted_count INTEGER := 0;
BEGIN
    -- Find uploads that have been hard-deleted (not in uploads table)
    -- This would need to be tracked separately or run as a scheduled job
    -- For now, just log that cleanup should happen

    RAISE NOTICE 'Storage cleanup should be scheduled separately via API';
    RAISE NOTICE 'Files older than 6 months should be removed from user-uploads bucket';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- UPDATE CRON JOB (if needed)
-- ============================================================
-- The existing cron job will now use the updated function automatically
-- No changes needed if you already have the cron job scheduled

-- To verify your cron job:
-- SELECT * FROM cron.job WHERE jobname = 'delete-expired-data';

-- ============================================================
-- TESTING FUNCTIONS
-- ============================================================

-- View soft-deleted data (admin only)
CREATE OR REPLACE VIEW soft_deleted_data AS
SELECT
    'conversation' as type,
    id,
    deleted_at,
    retention_until,
    NOW() - deleted_at as time_since_deletion,
    deleted_at + INTERVAL '3 months' as hard_delete_date
FROM public.conversations
WHERE deleted_at IS NOT NULL

UNION ALL

SELECT
    'message' as type,
    id,
    deleted_at,
    retention_until,
    NOW() - deleted_at as time_since_deletion,
    deleted_at + INTERVAL '3 months' as hard_delete_date
FROM public.messages
WHERE deleted_at IS NOT NULL

UNION ALL

SELECT
    'upload' as type,
    id,
    deleted_at,
    retention_until,
    NOW() - deleted_at as time_since_deletion,
    deleted_at + INTERVAL '3 months' as hard_delete_date
FROM public.uploads
WHERE deleted_at IS NOT NULL

ORDER BY deleted_at DESC;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'DATA RETENTION POLICY UPDATED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Retention Policy:';
    RAISE NOTICE '  0-3 months:  Data active and visible';
    RAISE NOTICE '  3-6 months:  Soft-deleted (hidden, recoverable)';
    RAISE NOTICE '  6+ months:   Hard-deleted (permanently removed)';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  • delete_expired_data() - Runs daily via cron';
    RAISE NOTICE '  • recover_soft_deleted_conversation(uuid) - Recover data';
    RAISE NOTICE '  • cleanup_storage_files() - Storage bucket cleanup';
    RAISE NOTICE '';
    RAISE NOTICE 'View: soft_deleted_data - Shows all recoverable data';
    RAISE NOTICE '============================================================';
END $$;

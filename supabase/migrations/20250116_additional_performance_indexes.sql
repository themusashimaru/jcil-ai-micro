-- ============================================
-- ADDITIONAL PERFORMANCE INDEXES
-- Migration: 20250116_additional_performance_indexes
-- Purpose: Add indexes for soft-delete, retention, and admin queries
-- ============================================

-- ============================================
-- SOFT DELETE INDEXES
-- These are critical for queries that filter out deleted items
-- ============================================

-- Conversations - filter deleted items efficiently
CREATE INDEX IF NOT EXISTS idx_conversations_user_deleted
ON conversations(user_id, deleted_at)
WHERE deleted_at IS NOT NULL;

-- Index for retention cleanup (find items past retention period)
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at
ON conversations(deleted_at)
WHERE deleted_at IS NOT NULL;

-- Messages - soft delete filtering
CREATE INDEX IF NOT EXISTS idx_messages_conversation_deleted
ON messages(conversation_id)
WHERE deleted_at IS NULL;

-- Index for message retention cleanup
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at
ON messages(deleted_at)
WHERE deleted_at IS NOT NULL;

-- ============================================
-- USAGE TRACKING INDEXES
-- For token counting and billing queries
-- ============================================

-- Usage tracking by date for reports
CREATE INDEX IF NOT EXISTS idx_usage_tracking_created
ON usage_tracking(created_at DESC);

-- Usage tracking by user for billing
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_created
ON usage_tracking(user_id, created_at DESC);

-- Usage tracking by model for cost analysis
CREATE INDEX IF NOT EXISTS idx_usage_tracking_model
ON usage_tracking(model_name, created_at DESC);

-- ============================================
-- ADMIN QUERY INDEXES
-- Optimize admin dashboard queries
-- ============================================

-- Users by subscription tier (for admin dashboard)
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier
ON users(subscription_tier);

-- Users by created date (for admin dashboard)
CREATE INDEX IF NOT EXISTS idx_users_created_at
ON users(created_at DESC);

-- Users active status
CREATE INDEX IF NOT EXISTS idx_users_deleted_at
ON users(deleted_at)
WHERE deleted_at IS NULL;

-- ============================================
-- UPLOADS INDEXES
-- For file management and cleanup
-- ============================================

-- Uploads by conversation (for cascading deletes)
CREATE INDEX IF NOT EXISTS idx_uploads_conversation
ON uploads(conversation_id);

-- Uploads by user (for user data export)
CREATE INDEX IF NOT EXISTS idx_uploads_user_created
ON uploads(user_id, created_at DESC);

-- Orphaned uploads (null conversation_id)
CREATE INDEX IF NOT EXISTS idx_uploads_orphaned
ON uploads(created_at)
WHERE conversation_id IS NULL;

-- ============================================
-- MEMORY RECORDS INDEXES
-- For persistent memory feature
-- ============================================

-- Memory by user (for memory retrieval)
CREATE INDEX IF NOT EXISTS idx_memory_user_created
ON memory_records(user_id, created_at DESC);

-- Memory by conversation
CREATE INDEX IF NOT EXISTS idx_memory_conversation
ON memory_records(conversation_id);

-- ============================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================
ANALYZE conversations;
ANALYZE messages;
ANALYZE usage_tracking;
ANALYZE users;
ANALYZE uploads;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON INDEX idx_conversations_deleted_at IS 'Retention cleanup - find soft-deleted conversations';
COMMENT ON INDEX idx_messages_deleted_at IS 'Retention cleanup - find soft-deleted messages';
COMMENT ON INDEX idx_usage_tracking_user_created IS 'Token usage queries for billing and limits';
COMMENT ON INDEX idx_users_subscription_tier IS 'Admin dashboard - filter users by tier';
COMMENT ON INDEX idx_uploads_orphaned IS 'Cleanup job - find orphaned uploads';

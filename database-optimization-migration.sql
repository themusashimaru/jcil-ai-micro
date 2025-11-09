-- ============================================
-- DATABASE OPTIMIZATION MIGRATION
-- ============================================
-- This migration adds performance indexes for common queries
-- Run this in your Supabase SQL Editor
-- Created: 2025-11-09

-- ============================================
-- 1. ADD INDEXES FOR PERFORMANCE
-- ============================================

-- Index for loading recent messages across conversations (memory system)
CREATE INDEX IF NOT EXISTS idx_messages_user_created
ON messages(user_id, created_at DESC);

-- Index for loading conversation messages (conversation history)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages(conversation_id, created_at ASC);

-- Index for loading user's conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_created
ON conversations(user_id, created_at DESC);

-- Index for loading images for specific messages
CREATE INDEX IF NOT EXISTS idx_message_images_message_id
ON message_images(message_id);

-- Composite index for conversation + user queries (RLS optimization)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_user
ON messages(conversation_id, user_id);

-- ============================================
-- 2. ADD MISSING COLUMNS (if needed)
-- ============================================

-- Ensure conversations table has an id column that can be manually set
-- (This allows us to set the UUID from the frontend to prevent race conditions)
-- Note: This should already exist, but we're making sure it's properly configured

-- Check if conversations.id is set to auto-generate by default
-- If so, we need to allow manual ID assignment
-- Run this to allow manual ID insertion:
ALTER TABLE conversations ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ============================================
-- 3. OPTIMIZE EXISTING DATA
-- ============================================

-- Update statistics for query planner
ANALYZE messages;
ANALYZE conversations;
ANALYZE message_images;
ANALYZE user_profiles;

-- ============================================
-- 4. PERFORMANCE MONITORING QUERIES
-- ============================================

-- Run these queries to check index usage and table sizes:

-- Check table sizes:
-- SELECT
--   schemaname,
--   tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage:
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================
-- NOTES:
-- ============================================
-- These indexes will significantly improve query performance for:
-- 1. Loading conversation history
-- 2. Cross-conversation memory system
-- 3. Loading user's conversation list
-- 4. Loading images for messages
--
-- The indexes are non-destructive and can be created while the database is running.
-- They will automatically be used by the PostgreSQL query planner when appropriate.

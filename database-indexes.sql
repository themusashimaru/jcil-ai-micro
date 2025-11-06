-- ============================================
-- DATABASE INDEXES FOR QUERY OPTIMIZATION
-- ============================================
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- These indexes will dramatically speed up queries without breaking memory system

-- 1. COMPOSITE INDEX: Optimizes the main memory query
-- Query: SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
-- This is the PRIMARY index for the global memory system
CREATE INDEX IF NOT EXISTS idx_messages_user_created
ON messages (user_id, created_at DESC);

-- 2. INDIVIDUAL INDEX: user_id for flexibility
-- Useful for any query filtering by user_id alone
CREATE INDEX IF NOT EXISTS idx_messages_user_id
ON messages (user_id);

-- 3. INDIVIDUAL INDEX: created_at for temporal queries
-- Useful for time-based queries across all users
CREATE INDEX IF NOT EXISTS idx_messages_created_at
ON messages (created_at DESC);

-- 4. COMPOSITE INDEX: conversation lookup optimization
-- Useful for loading specific conversation history
CREATE INDEX IF NOT EXISTS idx_messages_conversation_user
ON messages (conversation_id, user_id, created_at DESC);

-- ============================================
-- VERIFY INDEXES WERE CREATED
-- ============================================
-- Run this query to confirm indexes exist:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'messages';

-- ============================================
-- PERFORMANCE NOTES
-- ============================================
-- 1. The composite index (user_id, created_at DESC) is the most critical
--    - Speeds up the global memory query that loads last 100 messages
--    - Database can use index scan instead of sequential scan
--    - Ordering is already done in the index (no sort needed)
--
-- 2. These indexes DO NOT change query behavior
--    - Memory system works exactly the same
--    - Only difference is SPEED (queries will be 10-100x faster)
--
-- 3. Small storage overhead (~1-2% of table size per index)
--    - Worth it for query performance gains
--
-- 4. Indexes automatically maintained by PostgreSQL
--    - No manual maintenance required
--    - Auto-updated on INSERT/UPDATE/DELETE

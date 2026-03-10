-- ============================================
-- SCALING PERFORMANCE INDEXES
-- Migration: 20250109_scaling_indexes
-- Purpose: Optimize database for 100K+ concurrent users
-- ============================================

-- Rate limits table indexes (queried on EVERY request)
-- These are critical for performance at scale
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_key
ON rate_limits(user_id, key);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_key
ON rate_limits(ip_address, key)
WHERE ip_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires
ON rate_limits(expires_at);

CREATE INDEX IF NOT EXISTS idx_rate_limits_created
ON rate_limits(created_at);

-- Messages table indexes (frequent reads)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_user_created
ON messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_role
ON messages(role)
WHERE role IN ('user', 'assistant');

-- Conversations table indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
ON conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user_created
ON conversations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_folder
ON conversations(folder_id)
WHERE folder_id IS NOT NULL;

-- User usage tracking (for billing/limits)
CREATE INDEX IF NOT EXISTS idx_user_usage_user_period
ON user_usage(user_id, period_start);

CREATE INDEX IF NOT EXISTS idx_user_usage_period
ON user_usage(period_start, period_end);

-- Pending requests (for background processing)
CREATE INDEX IF NOT EXISTS idx_pending_requests_status
ON pending_requests(status, created_at);

CREATE INDEX IF NOT EXISTS idx_pending_requests_user
ON pending_requests(user_id, created_at DESC);

-- Audit log indexes (for compliance)
CREATE INDEX IF NOT EXISTS idx_audit_log_user_time
ON audit_log(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action_time
ON audit_log(action, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_resource
ON audit_log(resource_type, resource_id);

-- Sessions/auth indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user
ON sessions(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_token
ON sessions(session_token);

-- Code lab sessions
CREATE INDEX IF NOT EXISTS idx_code_lab_sessions_user
ON code_lab_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_code_lab_sessions_sandbox
ON code_lab_sessions(sandbox_id)
WHERE sandbox_id IS NOT NULL;

-- ============================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================
ANALYZE rate_limits;
ANALYZE messages;
ANALYZE conversations;
ANALYZE user_usage;
ANALYZE pending_requests;
ANALYZE audit_log;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON INDEX idx_rate_limits_user_key IS 'Primary lookup for user rate limiting - called on every API request';
COMMENT ON INDEX idx_rate_limits_ip_key IS 'IP-based rate limiting for anonymous users';
COMMENT ON INDEX idx_messages_conversation_created IS 'Fast message loading for conversations';
COMMENT ON INDEX idx_conversations_user_updated IS 'User conversation list sorted by recent activity';

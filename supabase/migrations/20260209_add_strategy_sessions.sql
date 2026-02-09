-- Migration: Add strategy_sessions and related tables
-- These tables are required for the Deep Strategy Agent and Deep Writer to function
-- The previous migration (20260127_add_strategy_events.sql) references this table
-- so this migration should have been created first

-- =============================================================================
-- STRATEGY SESSIONS TABLE
-- Main table for tracking agent sessions (Deep Strategy, Deep Writer, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS strategy_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phase TEXT NOT NULL DEFAULT 'intake',
    attachments JSONB DEFAULT '[]'::jsonb,
    problem_summary TEXT,
    problem_data JSONB,
    intake_messages JSONB DEFAULT '[]'::jsonb,
    user_context JSONB DEFAULT '[]'::jsonb,
    result JSONB,
    total_agents INTEGER DEFAULT 0,
    completed_agents INTEGER DEFAULT 0,
    total_searches INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user's sessions
CREATE INDEX IF NOT EXISTS idx_strategy_sessions_user_id ON strategy_sessions(user_id);

-- Index for session lookup by session_id
CREATE INDEX IF NOT EXISTS idx_strategy_sessions_session_id ON strategy_sessions(session_id);

-- Index for phase filtering
CREATE INDEX IF NOT EXISTS idx_strategy_sessions_phase ON strategy_sessions(phase);

-- Composite index for user sessions ordered by time
CREATE INDEX IF NOT EXISTS idx_strategy_sessions_user_created ON strategy_sessions(user_id, created_at DESC);

-- RLS policies
ALTER TABLE strategy_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own sessions
CREATE POLICY "Users can read their own sessions" ON strategy_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own sessions
CREATE POLICY "Users can create their own sessions" ON strategy_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update their own sessions" ON strategy_sessions
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete their own sessions" ON strategy_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role has full access to sessions" ON strategy_sessions
    FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE strategy_sessions IS 'Stores Deep Strategy Agent session data including intake, execution, and results';

-- =============================================================================
-- STRATEGY FINDINGS TABLE
-- Stores discoveries made during agent execution
-- =============================================================================
CREATE TABLE IF NOT EXISTS strategy_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES strategy_sessions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_url TEXT,
    agent_name TEXT,
    confidence DECIMAL(3, 2),
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session's findings
CREATE INDEX IF NOT EXISTS idx_strategy_findings_session_id ON strategy_findings(session_id);

-- RLS policies
ALTER TABLE strategy_findings ENABLE ROW LEVEL SECURITY;

-- Users can read findings from their sessions
CREATE POLICY "Users can read their own session findings" ON strategy_findings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM strategy_sessions s
            WHERE s.id = strategy_findings.session_id
            AND s.user_id = auth.uid()
        )
    );

-- Service role has full access
CREATE POLICY "Service role has full access to findings" ON strategy_findings
    FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE strategy_findings IS 'Stores discoveries made by Deep Strategy Agent scouts';

-- =============================================================================
-- STRATEGY USAGE TABLE
-- Tracks token usage and costs for billing
-- =============================================================================
CREATE TABLE IF NOT EXISTS strategy_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES strategy_sessions(id) ON DELETE CASCADE,
    opus_tokens INTEGER DEFAULT 0,
    sonnet_tokens INTEGER DEFAULT 0,
    haiku_tokens INTEGER DEFAULT 0,
    brave_searches INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user's usage history
CREATE INDEX IF NOT EXISTS idx_strategy_usage_user_id ON strategy_usage(user_id);

-- Index for session usage
CREATE INDEX IF NOT EXISTS idx_strategy_usage_session_id ON strategy_usage(session_id);

-- RLS policies
ALTER TABLE strategy_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage
CREATE POLICY "Users can read their own usage" ON strategy_usage
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role has full access to usage" ON strategy_usage
    FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE strategy_usage IS 'Tracks Deep Strategy Agent token usage and costs for billing';

-- =============================================================================
-- UPDATE TRIGGER FOR updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_strategy_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_strategy_sessions_updated_at ON strategy_sessions;
CREATE TRIGGER trigger_strategy_sessions_updated_at
    BEFORE UPDATE ON strategy_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_strategy_sessions_updated_at();

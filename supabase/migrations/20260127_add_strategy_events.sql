-- Migration: Add strategy_events table for session replay on reconnect
-- This table stores tool execution events so users can see progress after reconnecting

-- Create strategy_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS strategy_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message TEXT,
    event_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by session_id
CREATE INDEX IF NOT EXISTS idx_strategy_events_session_id ON strategy_events(session_id);

-- Index for ordering by creation time
CREATE INDEX IF NOT EXISTS idx_strategy_events_created_at ON strategy_events(created_at);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_strategy_events_session_created ON strategy_events(session_id, created_at);

-- RLS policies
ALTER TABLE strategy_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read events from their sessions
-- Note: We join through strategy_sessions to verify ownership
CREATE POLICY "Users can read their own session events" ON strategy_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM strategy_sessions s
            WHERE s.session_id = strategy_events.session_id
            AND s.user_id = auth.uid()
        )
    );

-- Allow service role full access for API operations
CREATE POLICY "Service role has full access to events" ON strategy_events
    FOR ALL
    USING (auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE strategy_events IS 'Stores strategy execution events for session replay on reconnect';

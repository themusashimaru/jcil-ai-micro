-- PRESENCE TRACKING SCHEMA
-- For persistent presence information

-- Create presence table
CREATE TABLE IF NOT EXISTS session_presence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  client_id TEXT NOT NULL,

  -- Cursor and selection
  cursor_line INTEGER,
  cursor_column INTEGER,
  selection_start_line INTEGER,
  selection_end_line INTEGER,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'away')),

  -- Timestamps
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint per user per session
  CONSTRAINT unique_user_session UNIQUE (session_id, user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_presence_session ON session_presence(session_id);
CREATE INDEX IF NOT EXISTS idx_presence_user ON session_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_presence_activity ON session_presence(last_activity);

-- Auto-cleanup stale presence (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM session_presence
  WHERE last_activity < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Enable realtime for presence table
ALTER TABLE session_presence REPLICA IDENTITY FULL;

-- RLS policies
ALTER TABLE session_presence ENABLE ROW LEVEL SECURITY;

-- Users can see presence in sessions they belong to
CREATE POLICY "Users can view presence in their sessions"
  ON session_presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_presence.session_id
      AND s.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Users can update their own presence
CREATE POLICY "Users can update their own presence"
  ON session_presence FOR UPDATE
  USING (user_id = auth.uid());

-- Users can insert their own presence
CREATE POLICY "Users can insert their own presence"
  ON session_presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own presence
CREATE POLICY "Users can delete their own presence"
  ON session_presence FOR DELETE
  USING (user_id = auth.uid());

-- Function to update presence (upsert)
CREATE OR REPLACE FUNCTION upsert_presence(
  p_session_id UUID,
  p_user_id UUID,
  p_user_name TEXT,
  p_client_id TEXT,
  p_cursor_line INTEGER DEFAULT NULL,
  p_cursor_column INTEGER DEFAULT NULL,
  p_selection_start INTEGER DEFAULT NULL,
  p_selection_end INTEGER DEFAULT NULL,
  p_status TEXT DEFAULT 'active'
)
RETURNS void AS $$
BEGIN
  INSERT INTO session_presence (
    session_id, user_id, user_name, client_id,
    cursor_line, cursor_column,
    selection_start_line, selection_end_line,
    status, last_activity
  )
  VALUES (
    p_session_id, p_user_id, p_user_name, p_client_id,
    p_cursor_line, p_cursor_column,
    p_selection_start, p_selection_end,
    p_status, NOW()
  )
  ON CONFLICT (session_id, user_id)
  DO UPDATE SET
    user_name = EXCLUDED.user_name,
    client_id = EXCLUDED.client_id,
    cursor_line = COALESCE(EXCLUDED.cursor_line, session_presence.cursor_line),
    cursor_column = COALESCE(EXCLUDED.cursor_column, session_presence.cursor_column),
    selection_start_line = COALESCE(EXCLUDED.selection_start_line, session_presence.selection_start_line),
    selection_end_line = COALESCE(EXCLUDED.selection_end_line, session_presence.selection_end_line),
    status = EXCLUDED.status,
    last_activity = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

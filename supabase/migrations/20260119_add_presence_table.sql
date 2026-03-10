-- ============================================================
-- CODE LAB PRESENCE TRACKING SCHEMA
-- ============================================================
-- Purpose: Real-time presence tracking for collaborative editing
-- Features:
-- - User cursor positions
-- - Selection tracking
-- - Activity status (active/idle/away)
-- - Auto-cleanup of stale entries
-- ============================================================

-- Create presence table linked to code_lab_sessions
CREATE TABLE IF NOT EXISTS public.code_lab_presence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.code_lab_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT,
  client_id TEXT NOT NULL,

  -- User color for cursor (assigned on join)
  color TEXT DEFAULT '#FF6B6B',

  -- Cursor position
  cursor_line INTEGER,
  cursor_column INTEGER,
  cursor_position INTEGER, -- Character offset

  -- Selection range
  selection_start_line INTEGER,
  selection_end_line INTEGER,
  selection_start INTEGER, -- Character offset start
  selection_end INTEGER, -- Character offset end

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'away')),
  is_typing BOOLEAN DEFAULT false,

  -- Timestamps
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one entry per user per session
  CONSTRAINT unique_user_session_presence UNIQUE (session_id, user_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_code_lab_presence_session ON public.code_lab_presence(session_id);
CREATE INDEX IF NOT EXISTS idx_code_lab_presence_user ON public.code_lab_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_code_lab_presence_activity ON public.code_lab_presence(last_activity);
CREATE INDEX IF NOT EXISTS idx_code_lab_presence_status ON public.code_lab_presence(session_id, status);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.code_lab_presence ENABLE ROW LEVEL SECURITY;

-- Users can see presence in sessions they own
CREATE POLICY "Users can view presence in own sessions" ON public.code_lab_presence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.code_lab_sessions s
      WHERE s.id = code_lab_presence.session_id
      AND s.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Users can manage their own presence entries
CREATE POLICY "Users can insert own presence" ON public.code_lab_presence
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own presence" ON public.code_lab_presence
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own presence" ON public.code_lab_presence
  FOR DELETE USING (user_id = auth.uid());

-- Service role has full access
CREATE POLICY "Service role full access to presence" ON public.code_lab_presence
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Upsert presence (insert or update)
CREATE OR REPLACE FUNCTION public.upsert_code_lab_presence(
  p_session_id UUID,
  p_user_id UUID,
  p_user_name TEXT,
  p_user_email TEXT DEFAULT NULL,
  p_client_id TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_cursor_line INTEGER DEFAULT NULL,
  p_cursor_column INTEGER DEFAULT NULL,
  p_cursor_position INTEGER DEFAULT NULL,
  p_selection_start_line INTEGER DEFAULT NULL,
  p_selection_end_line INTEGER DEFAULT NULL,
  p_selection_start INTEGER DEFAULT NULL,
  p_selection_end INTEGER DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_is_typing BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_color TEXT;
BEGIN
  -- Generate color if not provided
  v_color := COALESCE(p_color, (
    CASE (EXTRACT(EPOCH FROM NOW())::INTEGER % 12)
      WHEN 0 THEN '#FF6B6B'
      WHEN 1 THEN '#4ECDC4'
      WHEN 2 THEN '#45B7D1'
      WHEN 3 THEN '#96CEB4'
      WHEN 4 THEN '#FFEAA7'
      WHEN 5 THEN '#DDA0DD'
      WHEN 6 THEN '#98D8C8'
      WHEN 7 THEN '#F7DC6F'
      WHEN 8 THEN '#BB8FCE'
      WHEN 9 THEN '#85C1E9'
      WHEN 10 THEN '#82E0AA'
      ELSE '#F8C471'
    END
  ));

  INSERT INTO public.code_lab_presence (
    session_id, user_id, user_name, user_email, client_id, color,
    cursor_line, cursor_column, cursor_position,
    selection_start_line, selection_end_line, selection_start, selection_end,
    status, is_typing, last_activity
  )
  VALUES (
    p_session_id, p_user_id, p_user_name, p_user_email,
    COALESCE(p_client_id, gen_random_uuid()::TEXT), v_color,
    p_cursor_line, p_cursor_column, p_cursor_position,
    p_selection_start_line, p_selection_end_line, p_selection_start, p_selection_end,
    p_status, p_is_typing, NOW()
  )
  ON CONFLICT (session_id, user_id)
  DO UPDATE SET
    user_name = EXCLUDED.user_name,
    user_email = COALESCE(EXCLUDED.user_email, code_lab_presence.user_email),
    client_id = COALESCE(EXCLUDED.client_id, code_lab_presence.client_id),
    cursor_line = COALESCE(EXCLUDED.cursor_line, code_lab_presence.cursor_line),
    cursor_column = COALESCE(EXCLUDED.cursor_column, code_lab_presence.cursor_column),
    cursor_position = COALESCE(EXCLUDED.cursor_position, code_lab_presence.cursor_position),
    selection_start_line = COALESCE(EXCLUDED.selection_start_line, code_lab_presence.selection_start_line),
    selection_end_line = COALESCE(EXCLUDED.selection_end_line, code_lab_presence.selection_end_line),
    selection_start = COALESCE(EXCLUDED.selection_start, code_lab_presence.selection_start),
    selection_end = COALESCE(EXCLUDED.selection_end, code_lab_presence.selection_end),
    status = EXCLUDED.status,
    is_typing = EXCLUDED.is_typing,
    last_activity = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup stale presence (entries older than 5 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_stale_code_lab_presence()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.code_lab_presence
  WHERE last_activity < NOW() - INTERVAL '5 minutes'
  RETURNING * INTO deleted_count;

  RETURN COALESCE(deleted_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get session presence (all users in a session)
CREATE OR REPLACE FUNCTION public.get_session_presence(p_session_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  client_id TEXT,
  color TEXT,
  cursor_line INTEGER,
  cursor_column INTEGER,
  cursor_position INTEGER,
  selection_start_line INTEGER,
  selection_end_line INTEGER,
  status TEXT,
  is_typing BOOLEAN,
  last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.user_name,
    p.user_email,
    p.client_id,
    p.color,
    p.cursor_line,
    p.cursor_column,
    p.cursor_position,
    p.selection_start_line,
    p.selection_end_line,
    p.status,
    p.is_typing,
    p.last_activity
  FROM public.code_lab_presence p
  WHERE p.session_id = p_session_id
    AND p.last_activity > NOW() - INTERVAL '5 minutes'
  ORDER BY p.connected_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove user from session
CREATE OR REPLACE FUNCTION public.remove_code_lab_presence(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM public.code_lab_presence
  WHERE session_id = p_session_id AND user_id = p_user_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- GRANTS
-- ============================================================
GRANT ALL ON public.code_lab_presence TO service_role;
GRANT ALL ON public.code_lab_presence TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_code_lab_presence TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_code_lab_presence TO service_role;
GRANT EXECUTE ON FUNCTION public.get_session_presence TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_code_lab_presence TO authenticated;

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
ALTER TABLE public.code_lab_presence REPLICA IDENTITY FULL;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'CODE LAB PRESENCE TABLE INSTALLED SUCCESSFULLY';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Table: code_lab_presence';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Real-time cursor tracking';
  RAISE NOTICE '  - Selection tracking';
  RAISE NOTICE '  - Activity status (active/idle/away)';
  RAISE NOTICE '  - Typing indicators';
  RAISE NOTICE '  - Auto-cleanup of stale entries';
  RAISE NOTICE '  - Supabase Realtime enabled';
  RAISE NOTICE '============================================================';
END $$;

-- ============================================================
-- JCIL.AI CODE LAB SCHEMA
-- ============================================================
-- Purpose: Full-featured code development workspace with:
-- - Session management (like Claude Code conversations)
-- - Message persistence with type categorization
-- - GitHub repository linking
-- - Code change tracking
-- - Workspace state management
-- ============================================================

-- ============================================================
-- 1. CODE LAB SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.code_lab_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Session properties
    title TEXT NOT NULL DEFAULT 'New Session',
    message_count INTEGER DEFAULT 0,
    has_summary BOOLEAN DEFAULT false,
    last_summary_at TIMESTAMP WITH TIME ZONE,

    -- Linked GitHub repository
    repo_owner TEXT,
    repo_name TEXT,
    repo_branch TEXT DEFAULT 'main',

    -- Code change tracking
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    files_changed INTEGER DEFAULT 0,

    -- Workspace state
    workspace_id TEXT, -- E2B sandbox ID
    last_commit_sha TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. CODE LAB MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.code_lab_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.code_lab_sessions(id) ON DELETE CASCADE,

    -- Message content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,

    -- Message type for filtering/display
    type TEXT DEFAULT 'chat' CHECK (type IN ('chat', 'code', 'workspace', 'search', 'summary', 'error')),

    -- Tool execution details (if applicable)
    tool_name TEXT,
    tool_input JSONB,
    tool_output JSONB,

    -- Attachments
    attachments JSONB, -- Array of {name, type, size, url}

    -- Metadata
    tokens_used INTEGER,
    model TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. CODE LAB WORKSPACES TABLE (E2B sandbox tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.code_lab_workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.code_lab_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- E2B sandbox info
    sandbox_id TEXT NOT NULL,
    template TEXT DEFAULT 'base',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'terminated')),

    -- Resource tracking
    cpu_usage REAL,
    memory_usage REAL,
    disk_usage REAL,

    -- Files snapshot
    file_tree JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- 4. CODE LAB FILE CHANGES TABLE (for diff tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.code_lab_file_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.code_lab_sessions(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.code_lab_messages(id) ON DELETE SET NULL,

    -- File info
    file_path TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'rename')),
    old_path TEXT, -- For renames

    -- Diff content
    old_content TEXT,
    new_content TEXT,
    diff_patch TEXT, -- Unified diff format

    -- Stats
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 5. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_code_lab_sessions_user_id ON public.code_lab_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_code_lab_sessions_updated ON public.code_lab_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_code_lab_sessions_repo ON public.code_lab_sessions(repo_owner, repo_name);

CREATE INDEX IF NOT EXISTS idx_code_lab_messages_session ON public.code_lab_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_code_lab_messages_created ON public.code_lab_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_code_lab_messages_type ON public.code_lab_messages(session_id, type);

CREATE INDEX IF NOT EXISTS idx_code_lab_workspaces_session ON public.code_lab_workspaces(session_id);
CREATE INDEX IF NOT EXISTS idx_code_lab_workspaces_user ON public.code_lab_workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_code_lab_workspaces_sandbox ON public.code_lab_workspaces(sandbox_id);

CREATE INDEX IF NOT EXISTS idx_code_lab_file_changes_session ON public.code_lab_file_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_code_lab_file_changes_path ON public.code_lab_file_changes(session_id, file_path);

-- ============================================================
-- 6. RLS POLICIES - SESSIONS
-- ============================================================
ALTER TABLE public.code_lab_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.code_lab_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create sessions" ON public.code_lab_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.code_lab_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON public.code_lab_sessions
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to sessions" ON public.code_lab_sessions
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 7. RLS POLICIES - MESSAGES
-- ============================================================
ALTER TABLE public.code_lab_messages ENABLE ROW LEVEL SECURITY;

-- Messages belong to sessions which belong to users
CREATE POLICY "Users can view messages in own sessions" ON public.code_lab_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.code_lab_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in own sessions" ON public.code_lab_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.code_lab_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete messages in own sessions" ON public.code_lab_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.code_lab_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access to messages" ON public.code_lab_messages
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 8. RLS POLICIES - WORKSPACES
-- ============================================================
ALTER TABLE public.code_lab_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspaces" ON public.code_lab_workspaces
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own workspaces" ON public.code_lab_workspaces
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to workspaces" ON public.code_lab_workspaces
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 9. RLS POLICIES - FILE CHANGES
-- ============================================================
ALTER TABLE public.code_lab_file_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view file changes in own sessions" ON public.code_lab_file_changes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.code_lab_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create file changes in own sessions" ON public.code_lab_file_changes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.code_lab_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access to file changes" ON public.code_lab_file_changes
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 10. FUNCTIONS
-- ============================================================

-- Update session message count trigger
CREATE OR REPLACE FUNCTION update_session_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.code_lab_sessions
        SET message_count = message_count + 1,
            updated_at = NOW()
        WHERE id = NEW.session_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.code_lab_sessions
        SET message_count = GREATEST(0, message_count - 1),
            updated_at = NOW()
        WHERE id = OLD.session_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_message_count
    AFTER INSERT OR DELETE ON public.code_lab_messages
    FOR EACH ROW EXECUTE FUNCTION update_session_message_count();

-- Update session code stats
CREATE OR REPLACE FUNCTION update_session_code_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.code_lab_sessions
    SET
        lines_added = (
            SELECT COALESCE(SUM(additions), 0)
            FROM public.code_lab_file_changes
            WHERE session_id = NEW.session_id
        ),
        lines_removed = (
            SELECT COALESCE(SUM(deletions), 0)
            FROM public.code_lab_file_changes
            WHERE session_id = NEW.session_id
        ),
        files_changed = (
            SELECT COUNT(DISTINCT file_path)
            FROM public.code_lab_file_changes
            WHERE session_id = NEW.session_id
        ),
        updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_code_stats
    AFTER INSERT ON public.code_lab_file_changes
    FOR EACH ROW EXECUTE FUNCTION update_session_code_stats();

-- ============================================================
-- 11. GRANTS
-- ============================================================
GRANT ALL ON public.code_lab_sessions TO service_role;
GRANT ALL ON public.code_lab_sessions TO authenticated;
GRANT ALL ON public.code_lab_messages TO service_role;
GRANT ALL ON public.code_lab_messages TO authenticated;
GRANT ALL ON public.code_lab_workspaces TO service_role;
GRANT ALL ON public.code_lab_workspaces TO authenticated;
GRANT ALL ON public.code_lab_file_changes TO service_role;
GRANT ALL ON public.code_lab_file_changes TO authenticated;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'CODE LAB SCHEMA INSTALLED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - code_lab_sessions (conversation containers)';
    RAISE NOTICE '  - code_lab_messages (chat history with tool calls)';
    RAISE NOTICE '  - code_lab_workspaces (E2B sandbox tracking)';
    RAISE NOTICE '  - code_lab_file_changes (file diff history)';
    RAISE NOTICE '';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  - Full session persistence';
    RAISE NOTICE '  - GitHub repo linking';
    RAISE NOTICE '  - Code change statistics';
    RAISE NOTICE '  - Workspace state management';
    RAISE NOTICE '  - Automatic message count updates';
    RAISE NOTICE '============================================================';
END $$;

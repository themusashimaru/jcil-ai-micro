-- ============================================================
-- JCIL.AI CHAT FOLDERS SCHEMA
-- ============================================================
-- Purpose: Allow users to organize chats into folders
-- - Single level folders (no nesting)
-- - Optional colors for visual organization
-- - Max 20 folders per user
-- - Drag-and-drop support
-- ============================================================

-- ============================================================
-- 1. CHAT FOLDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Folder properties
    name TEXT NOT NULL,
    color TEXT DEFAULT NULL, -- Hex color like '#3b82f6' or null for default
    position INTEGER DEFAULT 0, -- For ordering folders

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique folder names per user
    UNIQUE(user_id, name)
);

-- ============================================================
-- 2. ADD FOLDER_ID TO CONVERSATIONS TABLE
-- ============================================================
-- Add folder_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversations'
        AND column_name = 'folder_id'
    ) THEN
        ALTER TABLE public.conversations
        ADD COLUMN folder_id UUID REFERENCES public.chat_folders(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chat_folders_user_id ON public.chat_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_folders_position ON public.chat_folders(user_id, position);
CREATE INDEX IF NOT EXISTS idx_conversations_folder_id ON public.conversations(folder_id);

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================
ALTER TABLE public.chat_folders ENABLE ROW LEVEL SECURITY;

-- Users can only see their own folders
CREATE POLICY "Users can view own folders" ON public.chat_folders
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create folders (with limit check in application)
CREATE POLICY "Users can create folders" ON public.chat_folders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own folders
CREATE POLICY "Users can update own folders" ON public.chat_folders
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own folders
CREATE POLICY "Users can delete own folders" ON public.chat_folders
    FOR DELETE USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access to chat_folders" ON public.chat_folders
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. FUNCTION TO GET FOLDER COUNT FOR USER
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_folder_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.chat_folders
    WHERE user_id = p_user_id;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. FUNCTION TO REORDER FOLDERS
-- ============================================================
CREATE OR REPLACE FUNCTION reorder_folders(
    p_user_id UUID,
    p_folder_ids UUID[]
)
RETURNS void AS $$
DECLARE
    v_position INTEGER := 0;
    v_folder_id UUID;
BEGIN
    FOREACH v_folder_id IN ARRAY p_folder_ids
    LOOP
        UPDATE public.chat_folders
        SET position = v_position, updated_at = NOW()
        WHERE id = v_folder_id AND user_id = p_user_id;

        v_position := v_position + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. GRANTS
-- ============================================================
GRANT ALL ON public.chat_folders TO service_role;
GRANT ALL ON public.chat_folders TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_folder_count TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_folders TO authenticated;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'CHAT FOLDERS SCHEMA INSTALLED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Tables created/modified:';
    RAISE NOTICE '  - chat_folders (folder definitions)';
    RAISE NOTICE '  - conversations (added folder_id column)';
    RAISE NOTICE '';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  - Max 20 folders per user (enforced in app)';
    RAISE NOTICE '  - Optional color coding';
    RAISE NOTICE '  - Position-based ordering';
    RAISE NOTICE '  - Unique folder names per user';
    RAISE NOTICE '============================================================';
END $$;

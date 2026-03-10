-- ============================================================
-- FIX: CONVERSATIONS TABLE RLS POLICIES
-- ============================================================
-- Purpose: Ensure users can access their own conversations
-- Issue: Policies were using current_user_id() instead of auth.uid()
-- ============================================================

-- Ensure RLS is enabled
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (including old ones with wrong function)
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Service role full access to conversations" ON public.conversations;

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations" ON public.conversations
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert conversations they own
CREATE POLICY "Users can insert own conversations" ON public.conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations" ON public.conversations
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own conversations (soft delete)
CREATE POLICY "Users can delete own conversations" ON public.conversations
    FOR DELETE USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access to conversations" ON public.conversations
    FOR ALL USING (true) WITH CHECK (true);

-- Grant access to authenticated users
GRANT ALL ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

-- ============================================================
-- MESSAGES TABLE RLS POLICIES (if not already set)
-- ============================================================

-- Ensure RLS is enabled on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (including old ones with current_user_id())
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can create messages" ON public.messages;
DROP POLICY IF EXISTS "Service role full access to messages" ON public.messages;

-- Users can view messages in their conversations
CREATE POLICY "Users can view own messages" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- Users can insert messages in their conversations
CREATE POLICY "Users can insert own messages" ON public.messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- Users can update messages in their conversations
CREATE POLICY "Users can update own messages" ON public.messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- Users can delete messages in their conversations
CREATE POLICY "Users can delete own messages" ON public.messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- Service role can do everything
CREATE POLICY "Service role full access to messages" ON public.messages
    FOR ALL USING (true) WITH CHECK (true);

-- Grant access
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

-- ============================================================
-- CONVERSATION_MEMORY TABLE RLS POLICIES
-- ============================================================
-- Fix duplicate policies using current_user_id()

ALTER TABLE public.conversation_memory ENABLE ROW LEVEL SECURITY;

-- Drop old/duplicate policies
DROP POLICY IF EXISTS "Users can view own memory" ON public.conversation_memory;
DROP POLICY IF EXISTS "System can manage memory" ON public.conversation_memory;
DROP POLICY IF EXISTS "Users can view their own memory" ON public.conversation_memory;
DROP POLICY IF EXISTS "Users can insert their own memory" ON public.conversation_memory;
DROP POLICY IF EXISTS "Users can update their own memory" ON public.conversation_memory;
DROP POLICY IF EXISTS "Users can delete their own memory" ON public.conversation_memory;
DROP POLICY IF EXISTS "Service role can manage all memories" ON public.conversation_memory;

-- Create correct policies using auth.uid()
CREATE POLICY "Users can view their own memory" ON public.conversation_memory
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memory" ON public.conversation_memory
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memory" ON public.conversation_memory
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memory" ON public.conversation_memory
    FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for backend operations
CREATE POLICY "Service role can manage all memories" ON public.conversation_memory
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant access
GRANT ALL ON public.conversation_memory TO authenticated;
GRANT ALL ON public.conversation_memory TO service_role;

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
DECLARE
    v_conv_policy_count INTEGER;
    v_msg_policy_count INTEGER;
    v_mem_policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_conv_policy_count
    FROM pg_policies WHERE tablename = 'conversations';

    SELECT COUNT(*) INTO v_msg_policy_count
    FROM pg_policies WHERE tablename = 'messages';

    SELECT COUNT(*) INTO v_mem_policy_count
    FROM pg_policies WHERE tablename = 'conversation_memory';

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'RLS POLICIES INSTALLED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'conversations table policies: %', v_conv_policy_count;
    RAISE NOTICE 'messages table policies: %', v_msg_policy_count;
    RAISE NOTICE 'conversation_memory table policies: %', v_mem_policy_count;
    RAISE NOTICE '============================================================';
END $$;

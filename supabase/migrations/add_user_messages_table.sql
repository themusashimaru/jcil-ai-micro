-- ============================================================
-- JCIL.AI USER MESSAGES SCHEMA
-- ============================================================
-- Purpose: Admin-to-user messaging system
-- - Individual messages to specific users
-- - Broadcast messages to user tiers (plus, pro, executive, all)
-- - User inbox with read/delete functionality
-- ============================================================

-- ============================================================
-- 1. USER MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Recipient targeting
    recipient_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_tier TEXT, -- 'free', 'basic', 'pro', 'executive', 'all', or NULL for individual

    -- Sender info
    sender_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
    sender_admin_email TEXT NOT NULL,

    -- Message content
    subject TEXT NOT NULL,
    message TEXT NOT NULL,

    -- Message type
    message_type TEXT DEFAULT 'general' CHECK (message_type IN (
        'general',           -- General announcement
        'account',           -- Account-related (billing, subscription)
        'feature',           -- New feature announcement
        'maintenance',       -- System maintenance notice
        'promotion',         -- Special offer/promotion
        'support_response',  -- Response to support ticket
        'welcome',           -- Welcome message
        'warning'            -- Account warning
    )),

    -- Priority/importance
    priority TEXT DEFAULT 'normal' CHECK (priority IN (
        'low',
        'normal',
        'high',
        'urgent'
    )),

    -- Organization flags (per-user basis via junction table for broadcasts)
    is_pinned BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration for time-sensitive messages

    -- Broadcast tracking
    is_broadcast BOOLEAN DEFAULT false,
    broadcast_sent_count INTEGER DEFAULT 0
);

-- ============================================================
-- 2. USER MESSAGE STATUS TABLE (per-user read/delete tracking)
-- ============================================================
-- This tracks individual user's interaction with messages
-- Essential for broadcasts where one message maps to many users
CREATE TABLE IF NOT EXISTS public.user_message_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.user_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Status flags
    is_read BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,

    -- Timestamps
    read_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one status record per user per message
    UNIQUE(message_id, user_id)
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
-- Messages table indexes
CREATE INDEX idx_user_messages_recipient_user_id ON public.user_messages(recipient_user_id);
CREATE INDEX idx_user_messages_recipient_tier ON public.user_messages(recipient_tier);
CREATE INDEX idx_user_messages_message_type ON public.user_messages(message_type);
CREATE INDEX idx_user_messages_created_at ON public.user_messages(created_at DESC);
CREATE INDEX idx_user_messages_is_broadcast ON public.user_messages(is_broadcast);

-- Status table indexes
CREATE INDEX idx_user_message_status_user_id ON public.user_message_status(user_id);
CREATE INDEX idx_user_message_status_message_id ON public.user_message_status(message_id);
CREATE INDEX idx_user_message_status_is_read ON public.user_message_status(is_read);
CREATE INDEX idx_user_message_status_is_deleted ON public.user_message_status(is_deleted);

-- ============================================================
-- 4. FUNCTION TO GET USER'S MESSAGES
-- ============================================================
-- This function returns all messages for a user including:
-- - Direct messages to them
-- - Broadcast messages matching their tier
CREATE OR REPLACE FUNCTION get_user_messages(p_user_id UUID)
RETURNS TABLE (
    message_id UUID,
    subject TEXT,
    message TEXT,
    message_type TEXT,
    priority TEXT,
    sender_admin_email TEXT,
    is_broadcast BOOLEAN,
    is_read BOOLEAN,
    is_starred BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_user_tier TEXT;
BEGIN
    -- Get user's subscription tier
    SELECT subscription_tier INTO v_user_tier
    FROM public.users WHERE id = p_user_id;

    RETURN QUERY
    SELECT
        m.id as message_id,
        m.subject,
        m.message,
        m.message_type,
        m.priority,
        m.sender_admin_email,
        m.is_broadcast,
        COALESCE(s.is_read, false) as is_read,
        COALESCE(s.is_starred, false) as is_starred,
        m.created_at
    FROM public.user_messages m
    LEFT JOIN public.user_message_status s ON s.message_id = m.id AND s.user_id = p_user_id
    WHERE
        -- Not deleted by user
        COALESCE(s.is_deleted, false) = false
        -- Not expired
        AND (m.expires_at IS NULL OR m.expires_at > NOW())
        -- Either direct message to user OR broadcast matching their tier
        AND (
            m.recipient_user_id = p_user_id
            OR (
                m.is_broadcast = true
                AND (
                    m.recipient_tier = 'all'
                    OR m.recipient_tier = v_user_tier
                )
            )
        )
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. FUNCTION TO MARK MESSAGE AS READ
-- ============================================================
CREATE OR REPLACE FUNCTION mark_user_message_read(p_message_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO public.user_message_status (message_id, user_id, is_read, read_at)
    VALUES (p_message_id, p_user_id, true, NOW())
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET is_read = true, read_at = NOW()
    WHERE user_message_status.is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. FUNCTION TO DELETE MESSAGE FOR USER
-- ============================================================
CREATE OR REPLACE FUNCTION delete_user_message(p_message_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO public.user_message_status (message_id, user_id, is_deleted, deleted_at)
    VALUES (p_message_id, p_user_id, true, NOW())
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET is_deleted = true, deleted_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. FUNCTION TO GET UNREAD COUNT
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_unread_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_user_tier TEXT;
    v_count INTEGER;
BEGIN
    SELECT subscription_tier INTO v_user_tier
    FROM public.users WHERE id = p_user_id;

    SELECT COUNT(*) INTO v_count
    FROM public.user_messages m
    LEFT JOIN public.user_message_status s ON s.message_id = m.id AND s.user_id = p_user_id
    WHERE
        COALESCE(s.is_deleted, false) = false
        AND COALESCE(s.is_read, false) = false
        AND (m.expires_at IS NULL OR m.expires_at > NOW())
        AND (
            m.recipient_user_id = p_user_id
            OR (
                m.is_broadcast = true
                AND (m.recipient_tier = 'all' OR m.recipient_tier = v_user_tier)
            )
        );

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. RLS POLICIES
-- ============================================================
ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_message_status ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access to user_messages" ON public.user_messages
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to user_message_status" ON public.user_message_status
    FOR ALL USING (true) WITH CHECK (true);

-- Users can view messages sent to them (handled by function for broadcasts)
CREATE POLICY "Users can view own message status" ON public.user_message_status
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own message status" ON public.user_message_status
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own message status" ON public.user_message_status
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 9. GRANTS
-- ============================================================
GRANT ALL ON public.user_messages TO service_role;
GRANT ALL ON public.user_message_status TO service_role;
GRANT SELECT ON public.user_messages TO authenticated;
GRANT ALL ON public.user_message_status TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_user_messages TO authenticated;
GRANT EXECUTE ON FUNCTION mark_user_message_read TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_message TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_unread_count TO authenticated;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'USER MESSAGES SCHEMA INSTALLED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - user_messages (admin-to-user messages)';
    RAISE NOTICE '  - user_message_status (per-user read/delete tracking)';
    RAISE NOTICE '';
    RAISE NOTICE 'Message types: general, account, feature, maintenance,';
    RAISE NOTICE '               promotion, support_response, welcome, warning';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions: get_user_messages, mark_user_message_read,';
    RAISE NOTICE '           delete_user_message, get_user_unread_count';
    RAISE NOTICE '============================================================';
END $$;

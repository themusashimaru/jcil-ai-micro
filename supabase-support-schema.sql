-- ============================================================
-- JCIL.AI SUPPORT TICKET SYSTEM SCHEMA
-- ============================================================
-- Purpose: Admin inbox for user support and contact form messages
-- - Internal tickets (logged-in users)
-- - External tickets (landing page contact form)
-- - Admin replies with threading
-- - Category and status organization
-- ============================================================

-- ============================================================
-- 1. SUPPORT TICKETS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Source identification
    source TEXT NOT NULL CHECK (source IN ('internal', 'external')),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- NULL for external
    sender_email TEXT NOT NULL,
    sender_name TEXT,

    -- Message content
    category TEXT NOT NULL CHECK (category IN (
        'general',
        'technical_support',
        'bug_report',
        'feature_request',
        'billing',
        'content_moderation',
        'account_issue',
        'partnership',
        'feedback',
        'other'
    )),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,

    -- Status & organization
    status TEXT DEFAULT 'open' CHECK (status IN (
        'open',
        'in_progress',
        'awaiting_reply',
        'resolved',
        'closed'
    )),
    priority TEXT DEFAULT 'normal' CHECK (priority IN (
        'low',
        'normal',
        'high',
        'urgent'
    )),

    -- Organization flags
    is_read BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,

    -- Assignment (for future multi-admin support)
    assigned_to UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Spam protection
    ip_address INET,
    user_agent TEXT
);

-- Indexes for performance
CREATE INDEX idx_support_tickets_source ON public.support_tickets(source);
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_is_read ON public.support_tickets(is_read);
CREATE INDEX idx_support_tickets_is_archived ON public.support_tickets(is_archived);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at);

-- ============================================================
-- 2. SUPPORT REPLIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,

    -- Who replied
    admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
    admin_email TEXT, -- Store email in case admin is deleted

    -- Reply content
    message TEXT NOT NULL,

    -- Reply type
    is_internal_note BOOLEAN DEFAULT false, -- Internal notes not shown to user

    -- For external tickets: how was reply sent
    delivery_method TEXT CHECK (delivery_method IN ('in_app', 'email', 'mailto')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_support_replies_ticket_id ON public.support_replies(ticket_id);
CREATE INDEX idx_support_replies_admin_id ON public.support_replies(admin_id);
CREATE INDEX idx_support_replies_created_at ON public.support_replies(created_at);

-- ============================================================
-- 3. UPDATE TRIGGER FOR TICKETS
-- ============================================================
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_support_tickets_updated_at
    BEFORE UPDATE ON public.support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_support_ticket_timestamp();

-- ============================================================
-- 4. FUNCTION TO MARK TICKET AS READ
-- ============================================================
CREATE OR REPLACE FUNCTION mark_ticket_read(ticket_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.support_tickets
    SET is_read = true, read_at = NOW()
    WHERE id = ticket_uuid AND is_read = false;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. VIEW FOR TICKET COUNTS BY CATEGORY
-- ============================================================
CREATE OR REPLACE VIEW support_ticket_counts AS
SELECT
    category,
    status,
    source,
    is_read,
    is_starred,
    is_archived,
    COUNT(*) as count
FROM public.support_tickets
WHERE is_archived = false
GROUP BY category, status, source, is_read, is_starred, is_archived;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================
-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_replies ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access to tickets" ON public.support_tickets
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to replies" ON public.support_replies
    FOR ALL USING (true) WITH CHECK (true);

-- Users can view their own tickets (internal only)
CREATE POLICY "Users can view own tickets" ON public.support_tickets
    FOR SELECT USING (
        auth.uid() = user_id
    );

-- Users can create tickets for themselves
CREATE POLICY "Users can create own tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR user_id IS NULL
    );

-- Users can view replies to their tickets (non-internal notes only)
CREATE POLICY "Users can view replies to own tickets" ON public.support_replies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.support_tickets
            WHERE id = ticket_id AND user_id = auth.uid()
        )
        AND is_internal_note = false
    );

-- ============================================================
-- GRANTS
-- ============================================================
GRANT ALL ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_replies TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
GRANT ALL ON public.support_replies TO service_role;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'SUPPORT TICKET SCHEMA INSTALLED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - support_tickets (main tickets table)';
    RAISE NOTICE '  - support_replies (admin replies with threading)';
    RAISE NOTICE '';
    RAISE NOTICE 'Categories: general, technical_support, bug_report,';
    RAISE NOTICE '            feature_request, billing, content_moderation,';
    RAISE NOTICE '            account_issue, partnership, feedback, other';
    RAISE NOTICE '';
    RAISE NOTICE 'Statuses: open, in_progress, awaiting_reply, resolved, closed';
    RAISE NOTICE '============================================================';
END $$;

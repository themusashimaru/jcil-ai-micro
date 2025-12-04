-- ============================================================
-- JCIL-AI-MICRO COMPLETE DATABASE SCHEMA
-- ============================================================
-- Purpose: Full database setup for JCIL.AI Chat with:
-- - User authentication & profiles
-- - Subscription management (Free, Basic, Pro, Executive)
-- - Conversation & message storage with 3-month retention
-- - File upload tracking
-- - Tool usage logging
-- - Admin access control
-- - Activity tracking & audit logs
-- - Conversation memory for context recall
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT CHECK (role IN ('student', 'professional')) DEFAULT 'student',
    field TEXT, -- Area of study/work
    purpose TEXT, -- Why they're using the app

    -- Subscription
    subscription_tier TEXT CHECK (subscription_tier IN ('free', 'basic', 'pro', 'executive')) DEFAULT 'free',
    subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')) DEFAULT 'active',
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,

    -- Usage tracking
    messages_used_today INTEGER DEFAULT 0,
    images_generated_today INTEGER DEFAULT 0,
    last_message_date DATE,
    total_messages INTEGER DEFAULT 0,
    total_images INTEGER DEFAULT 0,

    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_banned BOOLEAN DEFAULT false,
    ban_reason TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes for performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_subscription_tier ON public.users(subscription_tier);
CREATE INDEX idx_users_stripe_customer_id ON public.users(stripe_customer_id);
CREATE INDEX idx_users_created_at ON public.users(created_at);
CREATE INDEX idx_users_deleted_at ON public.users(deleted_at);

-- ============================================================
-- 2. ADMIN USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,

    -- Admin permissions
    can_view_users BOOLEAN DEFAULT true,
    can_edit_users BOOLEAN DEFAULT true,
    can_view_conversations BOOLEAN DEFAULT true,
    can_export_data BOOLEAN DEFAULT true,
    can_manage_subscriptions BOOLEAN DEFAULT true,
    can_ban_users BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    last_access_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT unique_admin_email UNIQUE(email)
);

-- Insert your admin email
INSERT INTO public.admin_users (email, user_id)
VALUES ('the.musashi.maru@gmail.com', NULL)
ON CONFLICT (email) DO NOTHING;

CREATE INDEX idx_admin_users_email ON public.admin_users(email);

-- ============================================================
-- 3. CONVERSATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Conversation details
    title TEXT DEFAULT 'New Chat',
    tool_context TEXT CHECK (tool_context IN ('general', 'email', 'study', 'research', 'code', 'image', 'video', 'sms', 'scripture')),

    -- Memory & context
    summary TEXT, -- AI-generated summary for memory
    has_memory BOOLEAN DEFAULT false, -- Whether this conversation contributes to user memory

    -- Metadata
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Data retention (3 months)
    retention_until TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 months'),
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at);
CREATE INDEX idx_conversations_retention_until ON public.conversations(retention_until);
CREATE INDEX idx_conversations_deleted_at ON public.conversations(deleted_at);
CREATE INDEX idx_conversations_tool_context ON public.conversations(tool_context);

-- ============================================================
-- 4. MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Message content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    content_type TEXT CHECK (content_type IN ('text', 'image', 'code', 'error')) DEFAULT 'text',

    -- AI model info
    model_used TEXT, -- e.g., 'gpt-5.1'
    temperature REAL,
    tokens_used INTEGER,

    -- Attachments
    has_attachments BOOLEAN DEFAULT false,
    attachment_urls TEXT[], -- Array of URLs

    -- Moderation
    moderated BOOLEAN DEFAULT false,
    moderation_flagged BOOLEAN DEFAULT false,
    moderation_categories JSONB, -- Store flagged categories

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    retention_until TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 months'),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_user_id ON public.messages(user_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_messages_retention_until ON public.messages(retention_until);
CREATE INDEX idx_messages_role ON public.messages(role);

-- ============================================================
-- 5. UPLOADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,

    -- File details
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- MIME type
    file_size BIGINT NOT NULL, -- bytes
    storage_path TEXT NOT NULL, -- Path in Supabase storage
    storage_bucket TEXT DEFAULT 'user-uploads',

    -- File metadata
    upload_status TEXT CHECK (upload_status IN ('pending', 'completed', 'failed')) DEFAULT 'completed',

    -- Moderation
    moderated BOOLEAN DEFAULT false,
    moderation_flagged BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    retention_until TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 months'),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_uploads_user_id ON public.uploads(user_id);
CREATE INDEX idx_uploads_conversation_id ON public.uploads(conversation_id);
CREATE INDEX idx_uploads_retention_until ON public.uploads(retention_until);
CREATE INDEX idx_uploads_storage_path ON public.uploads(storage_path);

-- ============================================================
-- 6. TOOL USAGE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tool_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,

    -- Tool details
    tool_name TEXT NOT NULL CHECK (tool_name IN ('email', 'study', 'research', 'code', 'image', 'video', 'sms', 'scripture', 'general')),
    tool_action TEXT, -- Specific action taken

    -- Usage metadata
    tokens_used INTEGER,
    cost_estimate DECIMAL(10, 6), -- Cost in USD
    success BOOLEAN DEFAULT true,
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    retention_until TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 months'),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tool_usage_user_id ON public.tool_usage(user_id);
CREATE INDEX idx_tool_usage_tool_name ON public.tool_usage(tool_name);
CREATE INDEX idx_tool_usage_created_at ON public.tool_usage(created_at);
CREATE INDEX idx_tool_usage_retention_until ON public.tool_usage(retention_until);

-- ============================================================
-- 7. CONVERSATION MEMORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversation_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Memory content
    summary TEXT NOT NULL, -- Summary of past conversations
    key_topics TEXT[], -- Array of topics discussed
    user_preferences JSONB, -- User preferences learned over time

    -- Context
    conversation_ids UUID[], -- Array of conversation IDs this memory is based on
    last_conversations TEXT[], -- Array of recent conversation summaries

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_conversation_memory_user_id ON public.conversation_memory(user_id);
CREATE INDEX idx_conversation_memory_updated_at ON public.conversation_memory(updated_at);

-- ============================================================
-- 8. MODERATION LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moderation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    upload_id UUID REFERENCES public.uploads(id) ON DELETE SET NULL,

    -- Moderation details
    content_type TEXT CHECK (content_type IN ('text', 'image', 'file')),
    flagged BOOLEAN NOT NULL,
    categories JSONB, -- OpenAI moderation categories

    -- Action taken
    action_taken TEXT CHECK (action_taken IN ('allowed', 'blocked', 'warning')),
    moderator_notes TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    retention_until TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 months')
);

CREATE INDEX idx_moderation_logs_user_id ON public.moderation_logs(user_id);
CREATE INDEX idx_moderation_logs_flagged ON public.moderation_logs(flagged);
CREATE INDEX idx_moderation_logs_created_at ON public.moderation_logs(created_at);

-- ============================================================
-- 9. EXPORT LOGS TABLE (Audit trail for data exports)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.export_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    exported_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Admin who exported

    -- Export details
    export_type TEXT CHECK (export_type IN ('pdf', 'excel', 'csv', 'json')),
    export_scope TEXT CHECK (export_scope IN ('single_conversation', 'multiple_conversations', 'all_user_data', 'user_list', 'admin_report')),
    conversation_ids UUID[], -- If specific conversations

    -- Export reason
    reason TEXT CHECK (reason IN ('user_request', 'law_enforcement', 'admin_review', 'backup', 'data_deletion')),
    reason_notes TEXT,

    -- File info
    file_path TEXT,
    file_size BIGINT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_export_logs_user_id ON public.export_logs(user_id);
CREATE INDEX idx_export_logs_exported_by ON public.export_logs(exported_by);
CREATE INDEX idx_export_logs_created_at ON public.export_logs(created_at);
CREATE INDEX idx_export_logs_reason ON public.export_logs(reason);

-- ============================================================
-- 10. ADMIN ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,

    -- Activity details
    action_type TEXT NOT NULL CHECK (action_type IN (
        'view_user', 'edit_user', 'ban_user', 'unban_user',
        'change_subscription', 'view_conversation', 'export_data',
        'delete_conversation', 'delete_user', 'login', 'search'
    )),
    target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Action details
    details JSONB, -- Store action-specific data
    ip_address INET,
    user_agent TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_activity_logs_admin_id ON public.admin_activity_logs(admin_user_id);
CREATE INDEX idx_admin_activity_logs_action_type ON public.admin_activity_logs(action_type);
CREATE INDEX idx_admin_activity_logs_created_at ON public.admin_activity_logs(created_at);
CREATE INDEX idx_admin_activity_logs_target_user_id ON public.admin_activity_logs(target_user_id);

-- ============================================================
-- 11. SUBSCRIPTION HISTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Subscription details
    tier TEXT NOT NULL CHECK (tier IN ('free', 'basic', 'pro', 'executive')),
    status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),

    -- Stripe details
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    amount DECIMAL(10, 2),
    currency TEXT DEFAULT 'USD',

    -- Period
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,

    -- Change tracking
    changed_from_tier TEXT,
    changed_by UUID REFERENCES public.users(id), -- Admin who made the change
    change_reason TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscription_history_user_id ON public.subscription_history(user_id);
CREATE INDEX idx_subscription_history_created_at ON public.subscription_history(created_at);

-- ============================================================
-- 12. DAILY STATS TABLE (for admin dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stat_date DATE NOT NULL UNIQUE,

    -- User stats
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    free_users INTEGER DEFAULT 0,
    basic_users INTEGER DEFAULT 0,
    pro_users INTEGER DEFAULT 0,
    executive_users INTEGER DEFAULT 0,

    -- Usage stats
    total_messages INTEGER DEFAULT 0,
    total_conversations INTEGER DEFAULT 0,
    total_images_generated INTEGER DEFAULT 0,
    total_uploads INTEGER DEFAULT 0,

    -- Tool usage
    email_tool_usage INTEGER DEFAULT 0,
    study_tool_usage INTEGER DEFAULT 0,
    research_tool_usage INTEGER DEFAULT 0,
    code_tool_usage INTEGER DEFAULT 0,
    image_tool_usage INTEGER DEFAULT 0,

    -- Revenue (from Stripe)
    daily_revenue DECIMAL(10, 2) DEFAULT 0,
    mrr DECIMAL(10, 2) DEFAULT 0, -- Monthly Recurring Revenue

    -- Moderation
    flagged_messages INTEGER DEFAULT 0,
    flagged_uploads INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_daily_stats_stat_date ON public.daily_stats(stat_date);

-- ============================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_memory_updated_at BEFORE UPDATE ON public.conversation_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Reset daily usage counters
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS void AS $$
BEGIN
    UPDATE public.users
    SET
        messages_used_today = 0,
        images_generated_today = 0
    WHERE last_message_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Increment conversation message count
CREATE OR REPLACE FUNCTION increment_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET
        message_count = message_count + 1,
        last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_message_count AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION increment_conversation_message_count();

-- Update user last login
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users
    SET last_login_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: AUTO-DELETE EXPIRED DATA (3 months retention)
-- ============================================================
CREATE OR REPLACE FUNCTION delete_expired_data()
RETURNS void AS $$
BEGIN
    -- Soft delete expired conversations
    UPDATE public.conversations
    SET deleted_at = NOW()
    WHERE retention_until < NOW() AND deleted_at IS NULL;

    -- Soft delete expired messages
    UPDATE public.messages
    SET deleted_at = NOW()
    WHERE retention_until < NOW() AND deleted_at IS NULL;

    -- Soft delete expired uploads
    UPDATE public.uploads
    SET deleted_at = NOW()
    WHERE retention_until < NOW() AND deleted_at IS NULL;

    -- Soft delete expired tool usage
    UPDATE public.tool_usage
    SET deleted_at = NOW()
    WHERE retention_until < NOW() AND deleted_at IS NULL;

    -- Soft delete expired moderation logs
    DELETE FROM public.moderation_logs
    WHERE retention_until < NOW();

    RAISE NOTICE 'Expired data deleted successfully';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEWS FOR ADMIN DASHBOARD
-- ============================================================

-- Active users summary
CREATE OR REPLACE VIEW admin_users_summary AS
SELECT
    subscription_tier,
    COUNT(*) as user_count,
    COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '7 days' THEN 1 END) as active_last_7_days,
    COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '30 days' THEN 1 END) as active_last_30_days,
    SUM(total_messages) as total_messages,
    SUM(total_images) as total_images
FROM public.users
WHERE deleted_at IS NULL AND is_active = true
GROUP BY subscription_tier;

-- Conversation stats
CREATE OR REPLACE VIEW admin_conversation_stats AS
SELECT
    u.subscription_tier,
    c.tool_context,
    COUNT(*) as conversation_count,
    AVG(c.message_count) as avg_messages_per_conversation,
    SUM(c.message_count) as total_messages
FROM public.conversations c
JOIN public.users u ON c.user_id = u.id
WHERE c.deleted_at IS NULL
GROUP BY u.subscription_tier, c.tool_context;

-- Revenue summary (to be populated by Stripe webhooks)
CREATE OR REPLACE VIEW admin_revenue_summary AS
SELECT
    DATE_TRUNC('month', created_at) as month,
    tier,
    COUNT(*) as subscription_count,
    SUM(amount) as total_revenue
FROM public.subscription_history
WHERE status = 'active'
GROUP BY DATE_TRUNC('month', created_at), tier
ORDER BY month DESC;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

-- Grant access to authenticated users (via RLS policies defined next)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant access to service role (for admin operations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
-- ============================================================
-- 13. DESIGN SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.design_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Logo settings
    main_logo TEXT DEFAULT '/images/logo.png',
    header_logo TEXT,
    login_logo TEXT,
    favicon TEXT,

    -- Text settings
    site_name TEXT DEFAULT 'JCIL.ai',
    subtitle TEXT DEFAULT 'Your AI Assistant',

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Only allow one row in this table
CREATE UNIQUE INDEX unique_design_settings ON public.design_settings ((id IS NOT NULL));

-- Insert default settings
INSERT INTO public.design_settings (main_logo, header_logo, login_logo, favicon, site_name, subtitle)
VALUES ('/images/logo.png', '', '', '', 'JCIL.ai', 'Your AI Assistant')
ON CONFLICT DO NOTHING;

-- Apply update trigger
CREATE TRIGGER update_design_settings_updated_at BEFORE UPDATE ON public.design_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'JCIL-AI-MICRO DATABASE SCHEMA INSTALLED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run the RLS policies script (supabase-rls-policies.sql)';
    RAISE NOTICE '2. Set up storage bucket for uploads';
    RAISE NOTICE '3. Configure Stripe webhooks';
    RAISE NOTICE '4. Set up cron job for delete_expired_data()';
    RAISE NOTICE '============================================================';
END $$;

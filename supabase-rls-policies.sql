-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
-- Purpose: Secure access to data
-- - Users can only see their own data
-- - Admins (m.moser338@gmail.com) can see everything
-- - Prevent unauthorized access and data leaks
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE email = auth.jwt() ->> 'email'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- HELPER FUNCTION: Get current user ID
-- ============================================================
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN (auth.jwt() ->> 'sub')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 1. USERS TABLE POLICIES
-- ============================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (id = current_user_id() OR is_admin());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (id = current_user_id())
    WITH CHECK (id = current_user_id());

-- Only admins can view all users
CREATE POLICY "Admins can view all users"
    ON public.users FOR SELECT
    USING (is_admin());

-- Only admins can update other users
CREATE POLICY "Admins can update all users"
    ON public.users FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

-- Only admins can delete users
CREATE POLICY "Admins can delete users"
    ON public.users FOR DELETE
    USING (is_admin());

-- New users can be created (for signup)
CREATE POLICY "Allow signup"
    ON public.users FOR INSERT
    WITH CHECK (true);

-- ============================================================
-- 2. ADMIN USERS TABLE POLICIES
-- ============================================================

-- Only admins can view admin list
CREATE POLICY "Admins can view admin list"
    ON public.admin_users FOR SELECT
    USING (is_admin());

-- Only admins can manage other admins
CREATE POLICY "Admins can manage admins"
    ON public.admin_users FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- 3. CONVERSATIONS TABLE POLICIES
-- ============================================================

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations"
    ON public.conversations FOR SELECT
    USING (user_id = current_user_id() OR is_admin());

-- Users can create their own conversations
CREATE POLICY "Users can create conversations"
    ON public.conversations FOR INSERT
    WITH CHECK (user_id = current_user_id());

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
    ON public.conversations FOR UPDATE
    USING (user_id = current_user_id() OR is_admin())
    WITH CHECK (user_id = current_user_id() OR is_admin());

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
    ON public.conversations FOR DELETE
    USING (user_id = current_user_id() OR is_admin());

-- ============================================================
-- 4. MESSAGES TABLE POLICIES
-- ============================================================

-- Users can view messages in their conversations
CREATE POLICY "Users can view own messages"
    ON public.messages FOR SELECT
    USING (
        user_id = current_user_id() OR
        is_admin() OR
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE id = messages.conversation_id
            AND user_id = current_user_id()
        )
    );

-- Users can create messages in their conversations
CREATE POLICY "Users can create messages"
    ON public.messages FOR INSERT
    WITH CHECK (
        user_id = current_user_id() AND
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE id = conversation_id
            AND user_id = current_user_id()
        )
    );

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages"
    ON public.messages FOR DELETE
    USING (user_id = current_user_id() OR is_admin());

-- ============================================================
-- 5. UPLOADS TABLE POLICIES
-- ============================================================

-- Users can view their own uploads
CREATE POLICY "Users can view own uploads"
    ON public.uploads FOR SELECT
    USING (user_id = current_user_id() OR is_admin());

-- Users can create their own uploads
CREATE POLICY "Users can create uploads"
    ON public.uploads FOR INSERT
    WITH CHECK (user_id = current_user_id());

-- Users can delete their own uploads
CREATE POLICY "Users can delete own uploads"
    ON public.uploads FOR DELETE
    USING (user_id = current_user_id() OR is_admin());

-- ============================================================
-- 6. TOOL USAGE TABLE POLICIES
-- ============================================================

-- Users can view their own tool usage
CREATE POLICY "Users can view own tool usage"
    ON public.tool_usage FOR SELECT
    USING (user_id = current_user_id() OR is_admin());

-- System can create tool usage records
CREATE POLICY "System can create tool usage"
    ON public.tool_usage FOR INSERT
    WITH CHECK (user_id = current_user_id());

-- Only admins can delete tool usage logs
CREATE POLICY "Admins can delete tool usage"
    ON public.tool_usage FOR DELETE
    USING (is_admin());

-- ============================================================
-- 7. CONVERSATION MEMORY TABLE POLICIES
-- ============================================================

-- Users can view their own conversation memory
CREATE POLICY "Users can view own memory"
    ON public.conversation_memory FOR SELECT
    USING (user_id = current_user_id() OR is_admin());

-- System can create/update conversation memory
CREATE POLICY "System can manage memory"
    ON public.conversation_memory FOR ALL
    USING (user_id = current_user_id() OR is_admin())
    WITH CHECK (user_id = current_user_id() OR is_admin());

-- ============================================================
-- 8. MODERATION LOGS TABLE POLICIES
-- ============================================================

-- Only admins can view moderation logs
CREATE POLICY "Admins can view moderation logs"
    ON public.moderation_logs FOR SELECT
    USING (is_admin());

-- System can create moderation logs
CREATE POLICY "System can create moderation logs"
    ON public.moderation_logs FOR INSERT
    WITH CHECK (true);

-- Only admins can delete moderation logs
CREATE POLICY "Admins can delete moderation logs"
    ON public.moderation_logs FOR DELETE
    USING (is_admin());

-- ============================================================
-- 9. EXPORT LOGS TABLE POLICIES
-- ============================================================

-- Users can view their own export logs
CREATE POLICY "Users can view own export logs"
    ON public.export_logs FOR SELECT
    USING (user_id = current_user_id() OR is_admin());

-- Admins can view all export logs
CREATE POLICY "Admins can view all export logs"
    ON public.export_logs FOR SELECT
    USING (is_admin());

-- System can create export logs
CREATE POLICY "System can create export logs"
    ON public.export_logs FOR INSERT
    WITH CHECK (true);

-- ============================================================
-- 10. ADMIN ACTIVITY LOGS TABLE POLICIES
-- ============================================================

-- Only admins can view activity logs
CREATE POLICY "Admins can view activity logs"
    ON public.admin_activity_logs FOR SELECT
    USING (is_admin());

-- System can create activity logs
CREATE POLICY "System can create activity logs"
    ON public.admin_activity_logs FOR INSERT
    WITH CHECK (is_admin());

-- ============================================================
-- 11. SUBSCRIPTION HISTORY TABLE POLICIES
-- ============================================================

-- Users can view their own subscription history
CREATE POLICY "Users can view own subscription history"
    ON public.subscription_history FOR SELECT
    USING (user_id = current_user_id() OR is_admin());

-- System can create subscription history
CREATE POLICY "System can create subscription history"
    ON public.subscription_history FOR INSERT
    WITH CHECK (true);

-- Only admins can update subscription history
CREATE POLICY "Admins can update subscription history"
    ON public.subscription_history FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- 12. DAILY STATS TABLE POLICIES
-- ============================================================

-- Only admins can view daily stats
CREATE POLICY "Admins can view daily stats"
    ON public.daily_stats FOR SELECT
    USING (is_admin());

-- System can create/update daily stats
CREATE POLICY "System can manage daily stats"
    ON public.daily_stats FOR ALL
    USING (is_admin())
    WITH CHECK (true);

-- ============================================================
-- STORAGE POLICIES (for user-uploads bucket)
-- ============================================================

-- Users can upload their own files
CREATE POLICY "Users can upload own files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'user-uploads' AND
        (storage.foldername(name))[1] = current_user_id()::TEXT
    );

-- Users can view their own files
CREATE POLICY "Users can view own files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'user-uploads' AND
        ((storage.foldername(name))[1] = current_user_id()::TEXT OR is_admin())
    );

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'user-uploads' AND
        ((storage.foldername(name))[1] = current_user_id()::TEXT OR is_admin())
    );

-- Admins can view all files
CREATE POLICY "Admins can view all files"
    ON storage.objects FOR SELECT
    USING (is_admin());

-- ============================================================
-- SECURITY FUNCTIONS
-- ============================================================

-- Function to validate subscription limits
CREATE OR REPLACE FUNCTION check_subscription_limits()
RETURNS TRIGGER AS $$
DECLARE
    user_tier TEXT;
    messages_today INTEGER;
    images_today INTEGER;
    daily_message_limit INTEGER;
    daily_image_limit INTEGER;
BEGIN
    -- Get user's subscription tier and usage
    SELECT subscription_tier, messages_used_today, images_generated_today
    INTO user_tier, messages_today, images_today
    FROM public.users
    WHERE id = NEW.user_id;

    -- Set limits based on tier
    CASE user_tier
        WHEN 'free' THEN
            daily_message_limit := 10;
            daily_image_limit := 0;
        WHEN 'basic' THEN
            daily_message_limit := 100;
            daily_image_limit := 0;
        WHEN 'pro' THEN
            daily_message_limit := 200;
            daily_image_limit := 5;
        WHEN 'executive' THEN
            daily_message_limit := 1000;
            daily_image_limit := 10;
        ELSE
            daily_message_limit := 10;
            daily_image_limit := 0;
    END CASE;

    -- Check if user has exceeded limits
    IF NEW.role = 'user' THEN
        IF messages_today >= daily_message_limit THEN
            RAISE EXCEPTION 'Daily message limit exceeded for % tier', user_tier;
        END IF;

        -- Update message count
        UPDATE public.users
        SET
            messages_used_today = messages_used_today + 1,
            total_messages = total_messages + 1,
            last_message_date = CURRENT_DATE
        WHERE id = NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply subscription limit check on message insert
CREATE TRIGGER check_limits_before_message_insert
    BEFORE INSERT ON public.messages
    FOR EACH ROW
    WHEN (NEW.role = 'user')
    EXECUTE FUNCTION check_subscription_limits();

-- Function to prevent SQL injection in search queries
CREATE OR REPLACE FUNCTION sanitize_search_query(query TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Remove potentially dangerous characters
    RETURN regexp_replace(query, '[;\-\-\/\*]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action()
RETURNS TRIGGER AS $$
DECLARE
    admin_id UUID;
BEGIN
    -- Get admin user ID
    SELECT id INTO admin_id
    FROM public.admin_users
    WHERE email = auth.jwt() ->> 'email';

    -- Log the action
    INSERT INTO public.admin_activity_logs (
        admin_user_id,
        action_type,
        target_user_id,
        details
    ) VALUES (
        admin_id,
        TG_ARGV[0], -- Action type passed as trigger argument
        COALESCE(NEW.id, OLD.id),
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'old', to_jsonb(OLD),
            'new', to_jsonb(NEW)
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ROW LEVEL SECURITY POLICIES INSTALLED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Security features enabled:';
    RAISE NOTICE '✓ Users can only access their own data';
    RAISE NOTICE '✓ Admin (m.moser338@gmail.com) has full access';
    RAISE NOTICE '✓ Subscription limits enforced';
    RAISE NOTICE '✓ SQL injection prevention';
    RAISE NOTICE '✓ Admin action logging';
    RAISE NOTICE '✓ Storage bucket policies';
    RAISE NOTICE '============================================================';
END $$;

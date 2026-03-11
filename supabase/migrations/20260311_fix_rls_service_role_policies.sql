-- ============================================================
-- Fix overly permissive "service role" RLS policies
--
-- Problem: Multiple tables have service role policies using
-- USING (true) WITHOUT checking auth.role() = 'service_role'.
-- Since PostgreSQL evaluates RLS as OR of all applicable policies,
-- any authenticated user could bypass user-scoped restrictions
-- and access ALL rows in these tables.
--
-- Fix: Replace USING (true) with USING (auth.role() = 'service_role')
-- for all service role policies.
--
-- Date: 2026-03-11
-- ============================================================

-- ============================================================
-- 1. conversations
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to conversations" ON public.conversations;
CREATE POLICY "Service role full access to conversations" ON public.conversations
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 2. messages
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to messages" ON public.messages;
CREATE POLICY "Service role full access to messages" ON public.messages
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 3. code_lab_sessions
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to sessions" ON public.code_lab_sessions;
CREATE POLICY "Service role full access to sessions" ON public.code_lab_sessions
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 4. code_lab_messages
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to messages" ON public.code_lab_messages;
CREATE POLICY "Service role full access to code_lab_messages" ON public.code_lab_messages
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 5. code_lab_workspaces
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to workspaces" ON public.code_lab_workspaces;
CREATE POLICY "Service role full access to workspaces" ON public.code_lab_workspaces
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 6. code_lab_file_changes
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to file changes" ON public.code_lab_file_changes;
CREATE POLICY "Service role full access to file changes" ON public.code_lab_file_changes
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 7. code_lab_presence
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to presence" ON public.code_lab_presence;
CREATE POLICY "Service role full access to presence" ON public.code_lab_presence
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 8. chat_folders
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to chat_folders" ON public.chat_folders;
CREATE POLICY "Service role full access to chat_folders" ON public.chat_folders
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 9. support_tickets
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to tickets" ON public.support_tickets;
CREATE POLICY "Service role full access to tickets" ON public.support_tickets
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 10. support_replies
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to replies" ON public.support_replies;
CREATE POLICY "Service role full access to replies" ON public.support_replies
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 11. user_messages
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to user_messages" ON public.user_messages;
CREATE POLICY "Service role full access to user_messages" ON public.user_messages
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 12. user_message_status
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to user_message_status" ON public.user_message_status;
CREATE POLICY "Service role full access to user_message_status" ON public.user_message_status
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 13. Drop exec_sql RPC function if it exists
-- This function allows arbitrary SQL execution and is a
-- critical security risk. The leads route should use proper
-- migrations instead.
-- ============================================================
DROP FUNCTION IF EXISTS public.exec_sql(text);
DROP FUNCTION IF EXISTS public.exec_sql(query text);

-- ============================================================
-- 14. Create website_leads table properly (so the exec_sql
-- fallback in leads/submit is never needed)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.website_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES website_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    business_name TEXT,
    lead_name TEXT NOT NULL,
    lead_email TEXT NOT NULL,
    lead_phone TEXT,
    message TEXT NOT NULL,
    source TEXT DEFAULT 'contact_form',
    ip_address TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'archived')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.website_leads ENABLE ROW LEVEL SECURITY;

-- Users can only see their own leads
CREATE POLICY "Users can view own leads" ON public.website_leads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads" ON public.website_leads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads" ON public.website_leads
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads" ON public.website_leads
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to website_leads" ON public.website_leads
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_website_leads_user ON public.website_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_website_leads_session ON public.website_leads(session_id);
CREATE INDEX IF NOT EXISTS idx_website_leads_status ON public.website_leads(status);

-- ============================================================
-- 15. Fix usage_tracking insert policy (overly permissive)
-- ============================================================
DROP POLICY IF EXISTS "Service role can insert usage" ON public.usage_tracking;
CREATE POLICY "Service role can insert usage" ON public.usage_tracking
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Verification: List all policies that still use USING(true)
-- (should only be intentionally public tables like settings,
--  provider_settings, rate_limits)
-- ============================================================
-- Run manually after applying:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE qual = 'true'
-- ORDER BY tablename;

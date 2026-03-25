-- ============================================================================
-- FIX CRITICAL RLS POLICY VULNERABILITIES
-- Date: 2026-03-25
-- Audit: SECURITY_AUDIT_REPORT.md
--
-- Problem: Multiple "service role full access" policies use FOR ALL USING (true)
-- WITHOUT the TO service_role clause, granting every authenticated user full
-- read/write access to all rows.
--
-- Fix: Drop the vulnerable policies and recreate with proper TO service_role.
-- Also restricts settings table and branding bucket to admin-only writes.
-- ============================================================================

-- ============================================================================
-- 1. SETTINGS TABLE — restrict updates to admins only
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can update settings" ON public.settings;

CREATE POLICY "Only admins can update settings"
  ON public.settings FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Service role can still manage settings (for API/migrations)
CREATE POLICY "Service role manages settings"
  ON public.settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. SUPPORT TICKETS — fix service role policy
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access to tickets" ON public.support_tickets;

CREATE POLICY "Service role full access to tickets"
  ON public.support_tickets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to replies" ON public.support_replies;

CREATE POLICY "Service role full access to replies"
  ON public.support_replies FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. USER MESSAGES — fix service role policies
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access to user_messages" ON public.user_messages;

CREATE POLICY "Service role full access to user_messages"
  ON public.user_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to user_message_status" ON public.user_message_status;

CREATE POLICY "Service role full access to user_message_status"
  ON public.user_message_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. CODE LAB TABLES — fix service role policies
-- ============================================================================

-- Sessions
DROP POLICY IF EXISTS "Service role full access to sessions" ON public.code_lab_sessions;

CREATE POLICY "Service role full access to sessions"
  ON public.code_lab_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Messages
DROP POLICY IF EXISTS "Service role full access to messages" ON public.code_lab_messages;

CREATE POLICY "Service role full access to messages"
  ON public.code_lab_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Workspaces
DROP POLICY IF EXISTS "Service role full access to workspaces" ON public.code_lab_workspaces;

CREATE POLICY "Service role full access to workspaces"
  ON public.code_lab_workspaces FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- File Changes
DROP POLICY IF EXISTS "Service role full access to file changes" ON public.code_lab_file_changes;

CREATE POLICY "Service role full access to file changes"
  ON public.code_lab_file_changes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Presence
DROP POLICY IF EXISTS "Service role full access to presence" ON public.code_lab_presence;

CREATE POLICY "Service role full access to presence"
  ON public.code_lab_presence FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5. MODERATION LOGS — restrict INSERT to service role
-- ============================================================================

DROP POLICY IF EXISTS "System can create moderation logs" ON public.moderation_logs;

CREATE POLICY "Service role can create moderation logs"
  ON public.moderation_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- 6. EXPORT LOGS — restrict INSERT to service role
-- ============================================================================

DROP POLICY IF EXISTS "System can create export logs" ON public.export_logs;

CREATE POLICY "Service role can create export logs"
  ON public.export_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- 7. SUBSCRIPTION HISTORY — restrict INSERT to service role
-- ============================================================================

DROP POLICY IF EXISTS "System can create subscription history" ON public.subscription_history;

CREATE POLICY "Service role can create subscription history"
  ON public.subscription_history FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- 8. BRANDING STORAGE BUCKET — restrict writes to admins only
-- ============================================================================

-- Drop overly permissive storage policies
DROP POLICY IF EXISTS "Authenticated can upload branding assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update branding assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete branding assets" ON storage.objects;

-- Recreate with admin-only restriction
-- Note: storage policies use bucket_id filter, not table name
CREATE POLICY "Only admins can upload branding assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND is_admin()
  );

CREATE POLICY "Only admins can update branding assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'branding'
    AND is_admin()
  )
  WITH CHECK (
    bucket_id = 'branding'
    AND is_admin()
  );

CREATE POLICY "Only admins can delete branding assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'branding'
    AND is_admin()
  );

-- ============================================================================
-- VERIFICATION COMMENT
-- After applying this migration, verify with:
--   SELECT schemaname, tablename, policyname, roles, cmd, qual
--   FROM pg_policies
--   WHERE tablename IN ('settings', 'support_tickets', 'user_messages',
--     'code_lab_sessions', 'code_lab_messages', 'code_lab_workspaces',
--     'code_lab_file_changes', 'code_lab_presence', 'moderation_logs',
--     'export_logs', 'subscription_history');
-- ============================================================================

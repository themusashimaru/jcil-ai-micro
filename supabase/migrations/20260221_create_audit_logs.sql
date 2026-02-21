-- CHAT-015: Create audit_logs table for compliance logging
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,
  metadata JSONB DEFAULT '{}',
  old_values JSONB,
  new_values JSONB,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
-- Index for action filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
-- Composite index for user + time range queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON public.audit_logs(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs via service role
-- No direct user access (audit logs are read via admin API)
CREATE POLICY "Service role full access" ON public.audit_logs
  FOR ALL USING (auth.role() = 'service_role');

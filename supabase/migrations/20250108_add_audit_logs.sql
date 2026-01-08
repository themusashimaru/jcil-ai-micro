-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
-- Comprehensive audit trail for SOC2/GDPR compliance
-- Tracks all significant user and admin actions

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- When
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Who
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- For admin impersonation

  -- What
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id TEXT,

  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id UUID,  -- Correlation ID for request tracing

  -- Details
  metadata JSONB DEFAULT '{}',
  old_values JSONB,  -- For UPDATE actions
  new_values JSONB,  -- For UPDATE/INSERT actions

  -- Status
  status VARCHAR(20) DEFAULT 'success',  -- success, failure, blocked
  error_message TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);

-- Composite index for user activity reports
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_activity
  ON audit_logs(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs (users cannot see their own for security)
CREATE POLICY "Admins can read audit logs" ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

-- System can insert (service role only)
CREATE POLICY "Service role can insert audit logs" ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- No updates or deletes allowed (immutable audit trail)
-- This is intentional - audit logs should never be modified

-- Add comment for documentation
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for compliance (SOC2, GDPR). Records all significant user and admin actions.';

-- ============================================
-- AUDIT LOG TYPES (for reference)
-- ============================================
--
-- Actions:
--   - auth.login, auth.logout, auth.register
--   - auth.password_change, auth.mfa_enable, auth.mfa_disable
--   - user.update_profile, user.delete_account
--   - conversation.create, conversation.delete, conversation.export
--   - message.send, message.delete
--   - subscription.upgrade, subscription.downgrade, subscription.cancel
--   - admin.impersonate, admin.access_user_data, admin.modify_user
--   - api.rate_limited, api.quota_exceeded
--   - security.csrf_blocked, security.suspicious_activity
--
-- Resource Types:
--   - user, conversation, message, subscription, passkey, token

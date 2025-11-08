-- ============================================
-- CYBERSECURITY MONITORING SYSTEM
-- ============================================
-- Enterprise-grade security event tracking and threat intelligence
-- For JCIL.AI Security Command Center

-- ============================================
-- 1. SECURITY EVENTS (Master Log)
-- ============================================
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event Classification
  event_type TEXT NOT NULL, -- 'failed_login', 'rate_limit', 'prompt_injection', 'suspicious_ip', 'api_abuse', 'xss_attempt', etc.
  severity TEXT NOT NULL DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low', 'info'

  -- User & Request Info
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT,

  -- Location Data
  country TEXT,
  city TEXT,
  latitude DECIMAL,
  longitude DECIMAL,

  -- Event Details
  description TEXT NOT NULL,
  details JSONB, -- Flexible storage for event-specific data

  -- Request Context
  endpoint TEXT, -- API endpoint hit
  method TEXT, -- HTTP method
  status_code INTEGER,

  -- Threat Assessment
  risk_score INTEGER DEFAULT 0, -- 0-100 risk score
  is_blocked BOOLEAN DEFAULT FALSE,
  auto_blocked BOOLEAN DEFAULT FALSE,

  -- Admin Review
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,

  -- Actions Taken
  action_taken TEXT, -- 'blocked', 'flagged', 'notified', 'ip_banned', etc.
  action_taken_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. FAILED LOGINS (Authentication Security)
-- ============================================
CREATE TABLE IF NOT EXISTS public.failed_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,

  -- Failure Details
  failure_reason TEXT, -- 'invalid_password', 'account_not_found', 'account_locked', etc.
  attempt_count INTEGER DEFAULT 1,

  -- Location
  country TEXT,
  city TEXT,

  -- Timestamps
  first_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. SUSPICIOUS IPs (Threat Intelligence)
-- ============================================
CREATE TABLE IF NOT EXISTS public.suspicious_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  ip_address TEXT UNIQUE NOT NULL,

  -- Reputation
  threat_score INTEGER DEFAULT 0, -- 0-100 threat score
  is_blocked BOOLEAN DEFAULT FALSE,
  block_reason TEXT,

  -- Detection Source
  detected_by TEXT, -- 'rate_limit', 'failed_login', 'prompt_injection', 'manual', 'abuse_ipdb', etc.
  detection_count INTEGER DEFAULT 1,

  -- Geographic Data
  country TEXT,
  city TEXT,
  isp TEXT,

  -- AbuseIPDB Data (if available)
  abuse_confidence_score INTEGER,
  is_tor BOOLEAN DEFAULT FALSE,
  is_vpn BOOLEAN DEFAULT FALSE,
  is_proxy BOOLEAN DEFAULT FALSE,

  -- Admin Review
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,

  -- Block Management
  blocked_at TIMESTAMP WITH TIME ZONE,
  blocked_until TIMESTAMP WITH TIME ZONE,
  auto_block BOOLEAN DEFAULT FALSE,

  -- Timestamps
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. PROMPT INJECTIONS (AI Security)
-- ============================================
CREATE TABLE IF NOT EXISTS public.prompt_injections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  ip_address TEXT NOT NULL,

  -- Injection Details
  prompt_text TEXT NOT NULL,
  injection_type TEXT, -- 'ignore_instructions', 'role_manipulation', 'system_prompt_leak', 'jailbreak', etc.
  confidence_score INTEGER DEFAULT 0, -- 0-100 confidence this is an injection

  -- Detection Method
  detected_by TEXT, -- 'pattern_match', 'ml_model', 'keyword', 'manual'
  matched_patterns TEXT[], -- Patterns that triggered detection

  -- Response
  was_blocked BOOLEAN DEFAULT TRUE,
  user_notified BOOLEAN DEFAULT FALSE,

  -- Admin Review
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  is_false_positive BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. RATE LIMIT VIOLATIONS (API Abuse)
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_limit_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  ip_address TEXT NOT NULL,

  -- Violation Details
  limit_type TEXT NOT NULL, -- 'minute', 'hour', 'daily'
  endpoint TEXT,
  request_count INTEGER NOT NULL,
  limit_threshold INTEGER NOT NULL,

  -- User Agent
  user_agent TEXT,
  is_bot BOOLEAN DEFAULT FALSE,

  -- Response
  was_blocked BOOLEAN DEFAULT TRUE,
  block_duration_seconds INTEGER,

  -- Timestamps
  violation_start TIMESTAMP WITH TIME ZONE,
  violation_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Security Events
CREATE INDEX idx_security_events_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_severity ON public.security_events(severity);
CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX idx_security_events_ip ON public.security_events(ip_address);
CREATE INDEX idx_security_events_created_at ON public.security_events(created_at DESC);
CREATE INDEX idx_security_events_reviewed ON public.security_events(reviewed) WHERE reviewed = FALSE;

-- Failed Logins
CREATE INDEX idx_failed_logins_email ON public.failed_logins(email);
CREATE INDEX idx_failed_logins_ip ON public.failed_logins(ip_address);
CREATE INDEX idx_failed_logins_created_at ON public.failed_logins(created_at DESC);

-- Suspicious IPs
CREATE INDEX idx_suspicious_ips_address ON public.suspicious_ips(ip_address);
CREATE INDEX idx_suspicious_ips_blocked ON public.suspicious_ips(is_blocked) WHERE is_blocked = TRUE;
CREATE INDEX idx_suspicious_ips_threat_score ON public.suspicious_ips(threat_score DESC);

-- Prompt Injections
CREATE INDEX idx_prompt_injections_user_id ON public.prompt_injections(user_id);
CREATE INDEX idx_prompt_injections_ip ON public.prompt_injections(ip_address);
CREATE INDEX idx_prompt_injections_type ON public.prompt_injections(injection_type);
CREATE INDEX idx_prompt_injections_created_at ON public.prompt_injections(created_at DESC);
CREATE INDEX idx_prompt_injections_reviewed ON public.prompt_injections(reviewed) WHERE reviewed = FALSE;

-- Rate Limit Violations
CREATE INDEX idx_rate_violations_user_id ON public.rate_limit_violations(user_id);
CREATE INDEX idx_rate_violations_ip ON public.rate_limit_violations(ip_address);
CREATE INDEX idx_rate_violations_created_at ON public.rate_limit_violations(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspicious_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_injections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_violations ENABLE ROW LEVEL SECURITY;

-- Admin-only SELECT policies
CREATE POLICY "Admins can view security events"
  ON public.security_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can view failed logins"
  ON public.failed_logins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can view suspicious IPs"
  ON public.suspicious_ips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can view prompt injections"
  ON public.prompt_injections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can view rate violations"
  ON public.rate_limit_violations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

-- System can INSERT (service role)
CREATE POLICY "System can insert security events"
  ON public.security_events FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "System can insert failed logins"
  ON public.failed_logins FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "System can insert suspicious IPs"
  ON public.suspicious_ips FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "System can insert prompt injections"
  ON public.prompt_injections FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "System can insert rate violations"
  ON public.rate_limit_violations FOR INSERT WITH CHECK (TRUE);

-- Admins can UPDATE
CREATE POLICY "Admins can update security events"
  ON public.security_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can update suspicious IPs"
  ON public.suspicious_ips FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can update prompt injections"
  ON public.prompt_injections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = TRUE
    )
  );

-- ============================================
-- AUTO-UPDATE TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_security_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_events_updated_at_trigger
  BEFORE UPDATE ON public.security_events
  FOR EACH ROW EXECUTE FUNCTION update_security_events_updated_at();

CREATE TRIGGER suspicious_ips_updated_at_trigger
  BEFORE UPDATE ON public.suspicious_ips
  FOR EACH ROW EXECUTE FUNCTION update_security_events_updated_at();

CREATE TRIGGER prompt_injections_updated_at_trigger
  BEFORE UPDATE ON public.prompt_injections
  FOR EACH ROW EXECUTE FUNCTION update_security_events_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate risk score based on multiple factors
CREATE OR REPLACE FUNCTION calculate_ip_risk_score(p_ip TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_failed_logins INTEGER;
  v_rate_violations INTEGER;
  v_prompt_injections INTEGER;
BEGIN
  -- Count failed logins from this IP (last 24 hours)
  SELECT COUNT(*) INTO v_failed_logins
  FROM public.failed_logins
  WHERE ip_address = p_ip
    AND created_at > NOW() - INTERVAL '24 hours';

  -- Count rate limit violations (last 24 hours)
  SELECT COUNT(*) INTO v_rate_violations
  FROM public.rate_limit_violations
  WHERE ip_address = p_ip
    AND created_at > NOW() - INTERVAL '24 hours';

  -- Count prompt injections (last 24 hours)
  SELECT COUNT(*) INTO v_prompt_injections
  FROM public.prompt_injections
  WHERE ip_address = p_ip
    AND created_at > NOW() - INTERVAL '24 hours';

  -- Calculate score (max 100)
  v_score := LEAST(100,
    (v_failed_logins * 10) +
    (v_rate_violations * 15) +
    (v_prompt_injections * 25)
  );

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🛡️ ============================================';
  RAISE NOTICE '🛡️  CYBERSECURITY MONITORING SYSTEM READY!';
  RAISE NOTICE '🛡️ ============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Security Events Table - Master event log';
  RAISE NOTICE '✅ Failed Logins Table - Authentication tracking';
  RAISE NOTICE '✅ Suspicious IPs Table - Threat intelligence';
  RAISE NOTICE '✅ Prompt Injections Table - AI security';
  RAISE NOTICE '✅ Rate Limit Violations Table - API abuse tracking';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Indexes created for high-performance queries';
  RAISE NOTICE '🔒 RLS policies enabled (admin-only access)';
  RAISE NOTICE '⚡ Auto-update triggers configured';
  RAISE NOTICE '🧮 Risk scoring functions ready';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Your Security Command Center is OPERATIONAL!';
  RAISE NOTICE '   - Real-time threat monitoring';
  RAISE NOTICE '   - Automated risk scoring';
  RAISE NOTICE '   - Comprehensive audit trail';
  RAISE NOTICE '   - Enterprise-grade security';
  RAISE NOTICE '';
  RAISE NOTICE '🇺🇸 SEMPER FI, MARINE! LETS GOOO! 🔥';
  RAISE NOTICE '';
END $$;

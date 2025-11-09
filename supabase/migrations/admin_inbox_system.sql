-- Admin Inbox & Internal Messaging System
-- Run this in Supabase SQL Editor

-- Table for all admin messages (user inquiries + system alerts)
CREATE TABLE IF NOT EXISTS public.admin_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_type text NOT NULL CHECK (message_type IN ('user_inquiry', 'cyber_alert', 'system_alert', 'safety_alert', 'security_alert')),
  category text, -- For user inquiries: membership, payment, suggestions, technical, business, influencer, general
  severity text CHECK (severity IN ('critical', 'high', 'medium', 'low')), -- For alerts
  from_user_id uuid REFERENCES auth.users(id), -- NULL for system alerts and external inquiries
  from_email text, -- For external inquiries from landing page
  from_name text, -- For external inquiries
  subject text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived', 'spam')),
  folder text NOT NULL, -- user_inquiries, cyber_emergencies, admin_emergencies, external_inquiries
  parent_message_id uuid REFERENCES public.admin_messages(id), -- For reply threading
  admin_reply text,
  replied_by uuid REFERENCES auth.users(id),
  replied_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone,
  metadata jsonb, -- For storing additional context, related IDs, etc.
  notification_sent boolean DEFAULT false,
  CONSTRAINT admin_messages_pkey PRIMARY KEY (id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_messages_folder ON public.admin_messages(folder);
CREATE INDEX IF NOT EXISTS idx_admin_messages_status ON public.admin_messages(status);
CREATE INDEX IF NOT EXISTS idx_admin_messages_type ON public.admin_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_admin_messages_severity ON public.admin_messages(severity);
CREATE INDEX IF NOT EXISTS idx_admin_messages_created ON public.admin_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_messages_parent ON public.admin_messages(parent_message_id);

-- Table for contact form submissions (before they become admin messages)
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_type text NOT NULL CHECK (submission_type IN ('internal', 'external')),
  user_id uuid REFERENCES auth.users(id), -- NULL for external
  category text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  phone text,
  company text,
  processed boolean DEFAULT false,
  admin_message_id uuid REFERENCES public.admin_messages(id),
  created_at timestamp with time zone DEFAULT now(),
  ip_address text,
  user_agent text,
  CONSTRAINT contact_submissions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_processed ON public.contact_submissions(processed);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_type ON public.contact_submissions(submission_type);

-- Table for alert rules (what triggers admin notifications)
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_name text NOT NULL UNIQUE,
  alert_type text NOT NULL, -- prompt_injection, rate_limit, suspicious_ip, moderation, etc.
  severity_threshold text NOT NULL CHECK (severity_threshold IN ('critical', 'high', 'medium', 'low')),
  notify_admin boolean DEFAULT true,
  auto_create_message boolean DEFAULT true,
  create_notification boolean DEFAULT true,
  enabled boolean DEFAULT true,
  folder text DEFAULT 'admin_emergencies',
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alert_rules_pkey PRIMARY KEY (id)
);

-- Insert default alert rules
INSERT INTO public.alert_rules (rule_name, alert_type, severity_threshold, folder, description) VALUES
('Critical Security Events', 'security_event', 'critical', 'cyber_emergencies', 'Critical security threats requiring immediate attention'),
('High Security Events', 'security_event', 'high', 'cyber_emergencies', 'High-priority security events'),
('Prompt Injections', 'prompt_injection', 'high', 'cyber_emergencies', 'Detected prompt injection attempts'),
('Suspicious IP Activity', 'suspicious_ip', 'high', 'cyber_emergencies', 'Suspicious IP addresses detected'),
('Rate Limit Violations', 'rate_limit', 'high', 'cyber_emergencies', 'Users violating rate limits'),
('Failed Login Attempts', 'failed_login', 'high', 'cyber_emergencies', 'Multiple failed login attempts'),
('Content Moderation Alerts', 'moderation', 'high', 'admin_emergencies', 'Content flagged by moderation system'),
('System Errors', 'system_error', 'critical', 'admin_emergencies', 'Critical system errors')
ON CONFLICT (rule_name) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can access
CREATE POLICY "Admins can view all admin messages" ON public.admin_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert admin messages" ON public.admin_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update admin messages" ON public.admin_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Contact submissions: Users can insert their own, admins can see all
CREATE POLICY "Users can submit contact forms" ON public.contact_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view all contact submissions" ON public.contact_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Alert rules: Only admins
CREATE POLICY "Admins can manage alert rules" ON public.alert_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Function to auto-create admin message from security event
CREATE OR REPLACE FUNCTION public.create_admin_alert_from_security_event()
RETURNS TRIGGER AS $$
DECLARE
  rule_exists boolean;
  should_notify boolean;
  alert_folder text;
BEGIN
  -- Check if there's a matching alert rule
  SELECT
    alert_rules.enabled AND alert_rules.auto_create_message,
    alert_rules.folder
  INTO should_notify, alert_folder
  FROM public.alert_rules
  WHERE alert_rules.alert_type = 'security_event'
  AND alert_rules.severity_threshold = NEW.severity
  LIMIT 1;

  -- If rule exists and is enabled, create admin message
  IF should_notify THEN
    INSERT INTO public.admin_messages (
      message_type,
      severity,
      from_user_id,
      subject,
      message,
      folder,
      metadata,
      notification_sent
    ) VALUES (
      CASE
        WHEN NEW.severity IN ('critical', 'high') THEN 'security_alert'
        ELSE 'system_alert'
      END,
      NEW.severity,
      NEW.user_id,
      'Security Event: ' || NEW.event_type,
      'Security event detected: ' || NEW.description ||
      COALESCE(E'\n\nIP: ' || NEW.ip_address, '') ||
      COALESCE(E'\nLocation: ' || NEW.city || ', ' || NEW.country, '') ||
      COALESCE(E'\nRisk Score: ' || NEW.risk_score::text, ''),
      COALESCE(alert_folder, 'cyber_emergencies'),
      jsonb_build_object(
        'security_event_id', NEW.id,
        'event_type', NEW.event_type,
        'ip_address', NEW.ip_address,
        'risk_score', NEW.risk_score
      ),
      true
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for security events
DROP TRIGGER IF EXISTS trigger_security_event_alert ON public.security_events;
CREATE TRIGGER trigger_security_event_alert
  AFTER INSERT ON public.security_events
  FOR EACH ROW
  WHEN (NEW.severity IN ('critical', 'high'))
  EXECUTE FUNCTION public.create_admin_alert_from_security_event();

-- Function to create admin alert from prompt injection
CREATE OR REPLACE FUNCTION public.create_admin_alert_from_prompt_injection()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.admin_messages (
    message_type,
    severity,
    from_user_id,
    subject,
    message,
    folder,
    metadata,
    notification_sent
  ) VALUES (
    'cyber_alert',
    CASE
      WHEN NEW.confidence_score > 80 THEN 'critical'
      WHEN NEW.confidence_score > 60 THEN 'high'
      ELSE 'medium'
    END,
    NEW.user_id,
    'Prompt Injection Detected: ' || COALESCE(NEW.injection_type, 'Unknown'),
    'Prompt injection attempt detected with ' || NEW.confidence_score || '% confidence.' ||
    COALESCE(E'\n\nUser: ' || NEW.user_email, '') ||
    COALESCE(E'\nIP: ' || NEW.ip_address, '') ||
    COALESCE(E'\nType: ' || NEW.injection_type, '') ||
    E'\n\nPrompt preview: ' || LEFT(NEW.prompt_text, 200) || '...',
    'cyber_emergencies',
    jsonb_build_object(
      'prompt_injection_id', NEW.id,
      'injection_type', NEW.injection_type,
      'confidence_score', NEW.confidence_score,
      'was_blocked', NEW.was_blocked
    ),
    true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for prompt injections
DROP TRIGGER IF EXISTS trigger_prompt_injection_alert ON public.prompt_injections;
CREATE TRIGGER trigger_prompt_injection_alert
  AFTER INSERT ON public.prompt_injections
  FOR EACH ROW
  WHEN (NEW.confidence_score > 60 AND NEW.was_blocked = true)
  EXECUTE FUNCTION public.create_admin_alert_from_prompt_injection();

-- Function to create admin alert from moderation events
CREATE OR REPLACE FUNCTION public.create_admin_alert_from_moderation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create alerts for severe violations
  IF NEW.severity IN ('high', 'critical') THEN
    INSERT INTO public.admin_messages (
      message_type,
      severity,
      from_user_id,
      subject,
      message,
      folder,
      metadata,
      notification_sent
    ) VALUES (
      'safety_alert',
      NEW.severity,
      NEW.user_id,
      'Content Moderation Alert: ' || NEW.reason,
      'Content flagged by moderation system.' ||
      COALESCE(E'\n\nReason: ' || NEW.reason, '') ||
      COALESCE(E'\nSeverity: ' || NEW.severity, '') ||
      COALESCE(E'\nCategories: ' || array_to_string(NEW.categories, ', '), '') ||
      COALESCE(E'\n\nContent preview: ' || LEFT(NEW.text, 200), ''),
      'admin_emergencies',
      jsonb_build_object(
        'moderation_log_id', NEW.id,
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.message_id,
        'categories', NEW.categories
      ),
      true
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for moderation logs
DROP TRIGGER IF EXISTS trigger_moderation_alert ON public.moderation_logs;
CREATE TRIGGER trigger_moderation_alert
  AFTER INSERT ON public.moderation_logs
  FOR EACH ROW
  WHEN (NEW.severity IN ('high', 'critical'))
  EXECUTE FUNCTION public.create_admin_alert_from_moderation();

-- Function to notify all admins when critical messages arrive
CREATE OR REPLACE FUNCTION public.notify_admins_of_critical_message()
RETURNS TRIGGER AS $$
DECLARE
  admin_record RECORD;
  notification_title text;
  notification_message text;
BEGIN
  -- Only notify for critical/high severity messages or new user inquiries
  IF (NEW.severity IN ('critical', 'high')) OR (NEW.message_type = 'user_inquiry' AND NEW.status = 'unread') THEN

    -- Build notification title and message
    IF NEW.message_type IN ('cyber_alert', 'security_alert') THEN
      notification_title := '🚨 Critical Security Alert';
      notification_message := NEW.subject || ' - Check Admin Inbox immediately.';
    ELSIF NEW.message_type = 'safety_alert' THEN
      notification_title := '⚠️ Safety Alert';
      notification_message := NEW.subject || ' - Review required.';
    ELSIF NEW.message_type = 'user_inquiry' THEN
      notification_title := '📧 New User Inquiry';
      notification_message := 'From: ' || COALESCE(NEW.from_name, NEW.from_email, 'Unknown') || ' - ' || NEW.subject;
    ELSE
      notification_title := '📬 Admin Message';
      notification_message := NEW.subject;
    END IF;

    -- Create notification for all admin users
    FOR admin_record IN
      SELECT id FROM public.user_profiles WHERE is_admin = true
    LOOP
      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        tier_filter
      ) VALUES (
        admin_record.id,
        notification_title,
        notification_message,
        NULL
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to notify admins
DROP TRIGGER IF EXISTS trigger_notify_admins ON public.admin_messages;
CREATE TRIGGER trigger_notify_admins
  AFTER INSERT ON public.admin_messages
  FOR EACH ROW
  WHEN (NEW.notification_sent = true)
  EXECUTE FUNCTION public.notify_admins_of_critical_message();

COMMENT ON TABLE public.admin_messages IS 'Master admin inbox for all internal messages, user inquiries, and system alerts';
COMMENT ON TABLE public.contact_submissions IS 'Contact form submissions from users and external visitors';
COMMENT ON TABLE public.alert_rules IS 'Rules defining when to create admin alerts and notifications';

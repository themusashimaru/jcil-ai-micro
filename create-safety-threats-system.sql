-- ============================================
-- SAFETY THREATS MONITORING SYSTEM
-- ============================================
-- Creates moderation_logs table for tracking flagged content
-- Supports admin safety monitoring panel

-- Create moderation_logs table
CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,

  -- Moderation details
  categories TEXT[] NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL,
  tip TEXT,
  severity TEXT NOT NULL DEFAULT 'medium', -- critical, high, medium, low

  -- Content that was flagged
  text TEXT,

  -- User context
  ip TEXT,
  user_agent TEXT,

  -- Admin review
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,

  -- Actions taken
  action_taken TEXT, -- suspended, banned, contacted_authorities, etc.
  action_taken_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id ON public.moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_severity ON public.moderation_logs(severity);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON public.moderation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_reviewed ON public.moderation_logs(reviewed) WHERE reviewed = FALSE;
CREATE INDEX IF NOT EXISTS idx_moderation_logs_categories ON public.moderation_logs USING GIN(categories);

-- Enable Row Level Security
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read moderation logs
CREATE POLICY "Admins can view all moderation logs"
  ON public.moderation_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = TRUE
    )
  );

-- Policy: System can insert moderation logs (service role)
CREATE POLICY "System can insert moderation logs"
  ON public.moderation_logs
  FOR INSERT
  WITH CHECK (TRUE);

-- Policy: Admins can update moderation logs
CREATE POLICY "Admins can update moderation logs"
  ON public.moderation_logs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = TRUE
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_moderation_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_moderation_logs_updated_at_trigger ON public.moderation_logs;
CREATE TRIGGER update_moderation_logs_updated_at_trigger
  BEFORE UPDATE ON public.moderation_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_moderation_logs_updated_at();

-- Function to categorize severity based on categories
CREATE OR REPLACE FUNCTION categorize_threat_severity(categories TEXT[])
RETURNS TEXT AS $$
BEGIN
  -- Critical threats (immediate danger)
  IF 'self-harm' = ANY(categories) OR
     'suicide' = ANY(categories) OR
     'violence' = ANY(categories) OR
     'terrorism' = ANY(categories) OR
     'extremism' = ANY(categories) OR
     'weapons' = ANY(categories) THEN
    RETURN 'critical';
  END IF;

  -- High threats
  IF 'hate' = ANY(categories) OR
     'hate/threats' = ANY(categories) OR
     'harassment/threats' = ANY(categories) OR
     'sexual/minors' = ANY(categories) THEN
    RETURN 'high';
  END IF;

  -- Medium threats
  IF 'harassment' = ANY(categories) OR
     'sexual' = ANY(categories) OR
     'illicit' = ANY(categories) THEN
    RETURN 'medium';
  END IF;

  -- Low threats
  RETURN 'low';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- SAMPLE DATA (for testing - remove in production)
-- ============================================
-- Uncomment to add sample data for testing the UI:

-- INSERT INTO public.moderation_logs (user_id, categories, reason, severity, text, ip, created_at)
-- SELECT
--   (SELECT id FROM auth.users LIMIT 1),
--   ARRAY['self-harm'],
--   'Self-harm content',
--   'critical',
--   'Sample flagged message for testing',
--   '192.168.1.1',
--   NOW() - (random() * INTERVAL '7 days')
-- FROM generate_series(1, 5);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Safety Threats Monitoring System created successfully!';
  RAISE NOTICE '🛡️ moderation_logs table ready';
  RAISE NOTICE '📊 Indexes created for performance';
  RAISE NOTICE '🔒 RLS policies enabled (admin-only access)';
  RAISE NOTICE '⚡ Auto-severity categorization function created';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next steps:';
  RAISE NOTICE '   1. Run this SQL in your Supabase dashboard';
  RAISE NOTICE '   2. Safety admin panel is ready to use';
  RAISE NOTICE '   3. Table will be empty until moderation is activated';
END $$;

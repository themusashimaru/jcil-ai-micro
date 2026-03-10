-- ============================================================================
-- MULTI-PROVIDER TRACKING MIGRATION
--
-- Adds provider tracking to support mid-conversation provider switching
-- between Claude, OpenAI GPT-5, xAI Grok 4, and DeepSeek V3.2
-- ============================================================================

-- Create provider enum type
DO $$ BEGIN
  CREATE TYPE ai_provider AS ENUM ('claude', 'openai', 'xai', 'deepseek');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================

-- Add provider column to conversations (tracks current/preferred provider)
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS provider ai_provider DEFAULT 'claude';

-- Add provider_history for tracking provider switches during conversation
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS provider_history jsonb DEFAULT '[]'::jsonb;

-- Add provider_preferences for user's provider settings in this conversation
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS provider_preferences jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN conversations.provider IS 'Current AI provider for this conversation';
COMMENT ON COLUMN conversations.provider_history IS 'History of provider switches with timestamps';
COMMENT ON COLUMN conversations.provider_preferences IS 'Provider-specific preferences (model, temperature, etc.)';

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================

-- Add provider column to messages (tracks which provider generated each message)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS provider ai_provider;

COMMENT ON COLUMN messages.provider IS 'AI provider that generated this message';

-- ============================================================================
-- CODE LAB SESSIONS TABLE
-- ============================================================================

-- Add provider column to code_lab_sessions
ALTER TABLE code_lab_sessions
ADD COLUMN IF NOT EXISTS provider ai_provider DEFAULT 'claude';

-- Add provider_history for tracking provider switches
ALTER TABLE code_lab_sessions
ADD COLUMN IF NOT EXISTS provider_history jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN code_lab_sessions.provider IS 'Current AI provider for this coding session';
COMMENT ON COLUMN code_lab_sessions.provider_history IS 'History of provider switches with timestamps';

-- ============================================================================
-- CODE LAB MESSAGES TABLE
-- ============================================================================

-- Add provider column to code_lab_messages
ALTER TABLE code_lab_messages
ADD COLUMN IF NOT EXISTS provider ai_provider;

COMMENT ON COLUMN code_lab_messages.provider IS 'AI provider that generated this message';

-- ============================================================================
-- TOKEN USAGE TABLE
-- ============================================================================

-- Add provider column to token_usage for per-provider usage tracking
ALTER TABLE token_usage
ADD COLUMN IF NOT EXISTS provider ai_provider;

-- Create index for provider-based queries
CREATE INDEX IF NOT EXISTS idx_token_usage_provider ON token_usage(provider);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_provider ON token_usage(user_id, provider);

COMMENT ON COLUMN token_usage.provider IS 'AI provider for this token usage record';

-- ============================================================================
-- USER PROVIDER PREFERENCES TABLE (NEW)
-- ============================================================================

-- Create new table for user-level provider preferences
CREATE TABLE IF NOT EXISTS user_provider_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  default_provider ai_provider DEFAULT 'claude',
  fallback_provider ai_provider DEFAULT 'openai',
  provider_api_keys jsonb DEFAULT '{}'::jsonb, -- Encrypted keys for user's own API keys
  provider_settings jsonb DEFAULT '{}'::jsonb, -- Per-provider settings
  auto_switch_enabled boolean DEFAULT false, -- Auto-switch on rate limit
  cost_optimization_enabled boolean DEFAULT false, -- Prefer cheaper providers
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS policies for user_provider_preferences
ALTER TABLE user_provider_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own provider preferences"
  ON user_provider_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own provider preferences"
  ON user_provider_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own provider preferences"
  ON user_provider_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own provider preferences"
  ON user_provider_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_user_provider_preferences_user_id
  ON user_provider_preferences(user_id);

COMMENT ON TABLE user_provider_preferences IS 'User-level AI provider preferences and settings';

-- ============================================================================
-- PROVIDER USAGE ANALYTICS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW provider_usage_analytics AS
SELECT
  provider,
  DATE(created_at) as usage_date,
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  COUNT(DISTINCT user_id) as unique_users
FROM token_usage
WHERE provider IS NOT NULL
GROUP BY provider, DATE(created_at)
ORDER BY usage_date DESC, provider;

COMMENT ON VIEW provider_usage_analytics IS 'Daily usage analytics by AI provider';

-- ============================================================================
-- UPDATE TRIGGER FOR user_provider_preferences
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_provider_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_provider_preferences_updated_at ON user_provider_preferences;
CREATE TRIGGER user_provider_preferences_updated_at
  BEFORE UPDATE ON user_provider_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_provider_preferences_updated_at();

-- Add custom_instructions TEXT column to user_settings
-- Allows users to provide persistent instructions that are injected
-- into the system prompt for every conversation (CHAT-009).

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS custom_instructions TEXT DEFAULT NULL;

COMMENT ON COLUMN public.user_settings.custom_instructions IS
  'User-defined instructions appended to the AI system prompt. Max 2000 chars, validated at API layer.';

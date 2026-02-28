-- Add perplexity_model column to provider_settings table
-- This allows admins to configure which Perplexity model to use for web search

-- Add perplexity_model column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'provider_settings'
        AND column_name = 'perplexity_model'
    ) THEN
        ALTER TABLE public.provider_settings
        ADD COLUMN perplexity_model TEXT DEFAULT 'sonar-pro';
    END IF;
END $$;

-- Also add code_command_model column if it doesn't exist (may have been missed)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'provider_settings'
        AND column_name = 'code_command_model'
    ) THEN
        ALTER TABLE public.provider_settings
        ADD COLUMN code_command_model TEXT DEFAULT 'claude-opus-4-5-20251101';
    END IF;
END $$;

-- Update existing row to have default values if columns were just added
UPDATE public.provider_settings
SET
    perplexity_model = COALESCE(perplexity_model, 'sonar-pro'),
    code_command_model = COALESCE(code_command_model, 'claude-opus-4-5-20251101')
WHERE perplexity_model IS NULL OR code_command_model IS NULL;

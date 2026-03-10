-- Provider Settings Table
-- Global settings for AI provider configuration (admin-only)

CREATE TABLE IF NOT EXISTS public.provider_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Active AI provider: 'openai' or 'anthropic'
    active_provider TEXT NOT NULL DEFAULT 'openai',

    -- Provider-specific settings (JSON for flexibility)
    -- e.g., { "model": "gpt-5-mini" } or { "model": "claude-sonnet-4-6" }
    provider_config JSONB DEFAULT '{}'::jsonb,

    -- Metadata
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Only allow one row (singleton pattern for global settings)
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_settings_singleton ON public.provider_settings ((true));

-- RLS policies (admin only)
ALTER TABLE public.provider_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read provider settings (needed for client-side feature detection)
CREATE POLICY "Anyone can read provider settings" ON public.provider_settings
    FOR SELECT USING (true);

-- Only admins can update provider settings
CREATE POLICY "Admins can update provider settings" ON public.provider_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid()
        )
    );

-- Only admins can insert (for initial setup)
CREATE POLICY "Admins can insert provider settings" ON public.provider_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid()
        )
    );

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_provider_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_provider_settings_updated_at ON public.provider_settings;
CREATE TRIGGER update_provider_settings_updated_at
    BEFORE UPDATE ON public.provider_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_provider_settings_updated_at();

-- Insert default settings if table is empty
INSERT INTO public.provider_settings (active_provider, provider_config)
SELECT 'openai', '{"model": "gpt-5-mini"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.provider_settings);

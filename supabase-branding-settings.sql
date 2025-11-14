-- Create branding_settings table to store logo and design settings
CREATE TABLE IF NOT EXISTS public.branding_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Logos (stored as base64 data URLs)
    main_logo TEXT,
    header_logo TEXT,
    login_logo TEXT,
    favicon TEXT,

    -- Text settings
    site_name TEXT DEFAULT 'JCIL.AI',
    subtitle TEXT DEFAULT 'Your AI Assistant',

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);

-- Only allow one row (singleton pattern)
CREATE UNIQUE INDEX idx_branding_settings_singleton ON public.branding_settings ((id IS NOT NULL));

-- Insert default row
INSERT INTO public.branding_settings (site_name, subtitle)
VALUES ('JCIL.AI', 'Faith-based AI tools for your everyday needs')
ON CONFLICT DO NOTHING;

-- RLS Policies
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

-- Admin users can read
CREATE POLICY "Admins can read branding settings"
    ON public.branding_settings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );

-- Admin users can update
CREATE POLICY "Admins can update branding settings"
    ON public.branding_settings
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_branding_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
CREATE TRIGGER update_branding_settings_timestamp
    BEFORE UPDATE ON public.branding_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_branding_settings_timestamp();

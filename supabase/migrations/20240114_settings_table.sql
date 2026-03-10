-- =====================================================
-- SETTINGS TABLE FOR REAL-TIME BRANDING/DESIGN
-- =====================================================
-- Purpose: Store all site branding and design settings in Supabase
-- Benefits: Real-time updates, no need to redeploy for logo changes
-- Usage: Admin panel reads/writes to this table

-- Create settings table
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Branding
  site_name TEXT DEFAULT 'JCIL.ai',
  site_tagline TEXT,

  -- Logos & Images (store Supabase Storage URLs)
  header_logo TEXT, -- Main logo in header
  favicon TEXT, -- Browser favicon
  login_logo TEXT, -- Logo on login/signup pages
  sidebar_logo TEXT, -- Logo in sidebar/collapsed state
  og_image TEXT, -- Open Graph image for social sharing

  -- Colors (hex codes)
  primary_color TEXT DEFAULT '#3B82F6', -- Blue
  secondary_color TEXT DEFAULT '#10B981', -- Green
  accent_color TEXT DEFAULT '#F59E0B', -- Amber
  background_color TEXT DEFAULT '#000000', -- Black

  -- Theme Settings
  theme_mode TEXT DEFAULT 'dark' CHECK (theme_mode IN ('light', 'dark', 'auto')),
  glassmorphism_enabled BOOLEAN DEFAULT true,

  -- SEO
  meta_description TEXT,
  meta_keywords TEXT[],

  -- Social Links
  twitter_url TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  linkedin_url TEXT,

  -- Contact
  support_email TEXT,
  support_phone TEXT,

  -- Features Flags
  maintenance_mode BOOLEAN DEFAULT false,
  signup_enabled BOOLEAN DEFAULT true,
  google_oauth_enabled BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT settings_only_one_row CHECK (id = '00000000-0000-0000-0000-000000000001'::UUID)
);

-- Insert default settings row (only one row allowed)
INSERT INTO public.settings (id, site_name)
VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'JCIL.ai')
ON CONFLICT (id) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS settings_updated_at ON public.settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_settings_updated_at();

-- Enable Row Level Security
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow everyone to read settings (public)
CREATE POLICY "Anyone can read settings"
  ON public.settings
  FOR SELECT
  TO public
  USING (true);

-- Only authenticated users can update (you can restrict to admin role later)
CREATE POLICY "Authenticated users can update settings"
  ON public.settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON public.settings(updated_at DESC);

-- =====================================================
-- STORAGE BUCKET FOR BRANDING ASSETS
-- =====================================================
-- Create a storage bucket for logos and images

-- Insert the bucket (run this in Supabase SQL Editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies

-- Allow public read access to branding assets
CREATE POLICY "Public can view branding assets"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'branding');

-- Allow authenticated users to upload branding assets
CREATE POLICY "Authenticated can upload branding assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'branding');

-- Allow authenticated users to update branding assets
CREATE POLICY "Authenticated can update branding assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'branding');

-- Allow authenticated users to delete branding assets
CREATE POLICY "Authenticated can delete branding assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'branding');

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get current settings (easy to call from API)
CREATE OR REPLACE FUNCTION public.get_settings()
RETURNS SETOF public.settings AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.settings LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anonymous and authenticated
GRANT EXECUTE ON FUNCTION public.get_settings() TO anon, authenticated;

-- =====================================================
-- USAGE INSTRUCTIONS
-- =====================================================
/*
1. Run this entire SQL file in your Supabase SQL Editor

2. Upload logos to Supabase Storage:
   - Go to Supabase Dashboard > Storage > branding bucket
   - Upload your logo files
   - Get the public URL (e.g., https://your-project.supabase.co/storage/v1/object/public/branding/header-logo.png)

3. Update settings table with logo URLs:
   UPDATE public.settings
   SET header_logo = 'https://your-project.supabase.co/storage/v1/object/public/branding/header-logo.png',
       favicon = 'https://your-project.supabase.co/storage/v1/object/public/branding/favicon.png'
   WHERE id = '00000000-0000-0000-0000-000000000001';

4. In your Next.js app, fetch settings:
   const { data } = await supabase.from('settings').select('*').single();

5. Subscribe to real-time changes:
   supabase
     .channel('settings-changes')
     .on('postgres_changes', {
       event: 'UPDATE',
       schema: 'public',
       table: 'settings'
     }, (payload) => {
       console.log('Settings updated:', payload.new);
     })
     .subscribe();
*/

-- ============================================
-- ENHANCE USER PROFILE WITH PERSONALIZATION FIELDS
-- ============================================
-- Adds optional fields to help AI provide more personalized,
-- context-aware, and effective responses

-- Add new columns to user_profiles table
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS purpose_of_use TEXT,
ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ;

-- Add comment to explain the new fields
COMMENT ON COLUMN public.user_profiles.full_name IS 'User''s full name (optional, for personalization)';
COMMENT ON COLUMN public.user_profiles.bio IS 'Brief description of user, background, or interests (optional)';
COMMENT ON COLUMN public.user_profiles.job_title IS 'User''s occupation or role (optional)';
COMMENT ON COLUMN public.user_profiles.purpose_of_use IS 'Why the user is using Slingshot (e.g., ministry, business, education)';
COMMENT ON COLUMN public.user_profiles.profile_updated_at IS 'When profile personalization fields were last updated';

-- Create index for profile searches (if needed in future)
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name ON public.user_profiles(full_name) WHERE full_name IS NOT NULL;

-- Update trigger function to set profile_updated_at
CREATE OR REPLACE FUNCTION public.update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.full_name IS DISTINCT FROM OLD.full_name OR
      NEW.bio IS DISTINCT FROM OLD.bio OR
      NEW.job_title IS DISTINCT FROM OLD.job_title OR
      NEW.purpose_of_use IS DISTINCT FROM OLD.purpose_of_use) THEN
    NEW.profile_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-update timestamp when profile fields change
DROP TRIGGER IF EXISTS on_profile_update ON public.user_profiles;
CREATE TRIGGER on_profile_update
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_timestamp();

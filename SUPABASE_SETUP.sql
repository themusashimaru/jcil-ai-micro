ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS education_level TEXT,
ADD COLUMN IF NOT EXISTS job_role TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_education ON public.user_profiles(education_level) WHERE education_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_job_role ON public.user_profiles(job_role) WHERE job_role IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_profile_personalization_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.education_level IS DISTINCT FROM OLD.education_level OR
      NEW.job_role IS DISTINCT FROM OLD.job_role) THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_personalization_update ON public.user_profiles;
CREATE TRIGGER on_profile_personalization_update
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_personalization_timestamp();

-- ============================================
-- IAM (Identity & Access Management) System
-- ============================================
-- Add role columns to user_profiles table

-- Add is_moderator column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN DEFAULT FALSE;

-- Add is_cyber_analyst column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_cyber_analyst BOOLEAN DEFAULT FALSE;

-- Create indexes for role filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_moderator ON public.user_profiles(is_moderator) WHERE is_moderator = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_cyber_analyst ON public.user_profiles(is_cyber_analyst) WHERE is_cyber_analyst = TRUE;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔐 ============================================';
  RAISE NOTICE '🔐  IAM SYSTEM READY!';
  RAISE NOTICE '🔐 ============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Added is_moderator column to user_profiles';
  RAISE NOTICE '✅ Added is_cyber_analyst column to user_profiles';
  RAISE NOTICE '✅ Created performance indexes';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Role Hierarchy:';
  RAISE NOTICE '   1. Admin - Full platform access';
  RAISE NOTICE '   2. Moderator - Content moderation access';
  RAISE NOTICE '   3. Cyber Analyst - Security monitoring access';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 IAM tab is now operational in Admin Dashboard!';
  RAISE NOTICE '';
END $$;

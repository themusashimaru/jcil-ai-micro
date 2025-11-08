-- ============================================
-- USER MODERATION SYSTEM
-- ============================================
-- Add suspension and ban fields to user_profiles table

-- Add moderation columns to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS moderation_notes TEXT;

-- Create index for faster moderation queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_suspended ON public.user_profiles(is_suspended) WHERE is_suspended = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_profiles_banned ON public.user_profiles(is_banned) WHERE is_banned = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_profiles_suspended_until ON public.user_profiles(suspended_until) WHERE suspended_until IS NOT NULL;

-- Function to automatically lift expired suspensions
CREATE OR REPLACE FUNCTION public.check_suspension_expiry()
RETURNS void AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    is_suspended = FALSE,
    suspended_until = NULL
  WHERE is_suspended = TRUE
    AND suspended_until IS NOT NULL
    AND suspended_until < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_suspension_expiry() TO authenticated;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ User moderation fields added successfully!';
  RAISE NOTICE '🔒 Fields added: is_suspended, suspended_until, suspension_reason, is_banned, banned_at, ban_reason, moderation_notes';
  RAISE NOTICE '📊 Indexes created for faster queries';
  RAISE NOTICE '⏰ Auto-expiry function created: check_suspension_expiry()';
END $$;

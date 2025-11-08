-- ============================================
-- FIX ADMIN RLS POLICY FOR USER_PROFILES
-- ============================================
-- Allow admins to update any user's profile

-- Drop existing policies if they conflict
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;

-- Create policy that allows admins to update any user's profile
CREATE POLICY "Admins can update all profiles"
ON public.user_profiles
FOR UPDATE
USING (
  -- Check if current user is an admin
  EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
    AND is_admin = TRUE
  )
)
WITH CHECK (
  -- Also check on the write side
  EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
    AND is_admin = TRUE
  )
);

-- Also allow admins to insert profiles for new users
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.user_profiles;

CREATE POLICY "Admins can insert profiles"
ON public.user_profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
    AND is_admin = TRUE
  )
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Admin RLS policies created successfully!';
  RAISE NOTICE '📊 Admins can now update and insert user profiles';
END $$;

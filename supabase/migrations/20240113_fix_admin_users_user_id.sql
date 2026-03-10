-- ============================================================
-- FIX ADMIN_USERS TABLE - ADD PROPER user_id
-- ============================================================
-- This fixes the admin_users table to have proper user_id instead of NULL
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Step 1: Update existing admin_users entries to have proper user_id
UPDATE public.admin_users au
SET user_id = u.id
FROM public.users u
WHERE au.email = u.email
  AND au.user_id IS NULL;

-- Step 2: Verify the update worked
SELECT
    au.id,
    au.email,
    au.user_id,
    u.id as user_table_id,
    CASE
        WHEN au.user_id IS NULL THEN 'ERROR: user_id is still NULL'
        WHEN au.user_id = u.id THEN 'OK: user_id matches'
        ELSE 'ERROR: user_id mismatch'
    END as status
FROM public.admin_users au
LEFT JOIN public.users u ON au.email = u.email;

-- Step 3: Update the is_admin() helper function to check by user_id instead of email
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE user_id = (auth.jwt() ->> 'sub')::UUID
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Make user_id required (NOT NULL) to prevent this issue in the future
-- Note: Only run this after Step 1 succeeds
ALTER TABLE public.admin_users
    ALTER COLUMN user_id SET NOT NULL;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
DECLARE
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM public.admin_users WHERE user_id IS NOT NULL;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ADMIN USERS TABLE FIXED';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✓ Admin users with valid user_id: %', admin_count;
    RAISE NOTICE '✓ is_admin() function updated to check user_id';
    RAISE NOTICE '✓ user_id column set to NOT NULL';
    RAISE NOTICE '============================================================';
END $$;

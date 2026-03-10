-- ============================================================
-- CLEANUP ADMIN USERS - ENSURE ONLY the.musashi.maru@gmail.com IS ADMIN
-- ============================================================
-- Run this in your Supabase SQL Editor to clean up admin access
-- ============================================================

-- Step 1: Show current state BEFORE cleanup
SELECT
    'BEFORE CLEANUP' as status,
    au.id,
    au.email,
    au.user_id,
    u.email as user_table_email,
    CASE
        WHEN au.email = 'the.musashi.maru@gmail.com' THEN 'KEEP - Owner'
        ELSE 'REMOVE - Unauthorized'
    END as action
FROM public.admin_users au
LEFT JOIN public.users u ON au.user_id = u.id
ORDER BY au.created_at;

-- Step 2: DELETE all admin users except the.musashi.maru@gmail.com
DELETE FROM public.admin_users
WHERE email != 'the.musashi.maru@gmail.com';

-- Step 3: Ensure the.musashi.maru@gmail.com exists and has proper user_id
INSERT INTO public.admin_users (email, user_id)
SELECT
    'the.musashi.maru@gmail.com',
    u.id
FROM public.users u
WHERE u.email = 'the.musashi.maru@gmail.com'
ON CONFLICT (email)
DO UPDATE SET
    user_id = EXCLUDED.user_id;

-- Step 4: If the.musashi.maru@gmail.com doesn't exist in users table yet, insert with NULL user_id
INSERT INTO public.admin_users (email, user_id)
VALUES ('the.musashi.maru@gmail.com', NULL)
ON CONFLICT (email) DO NOTHING;

-- Step 5: Make user_id required after setting it (only if user exists)
-- This will fail if user_id is still NULL, which is fine - it means you haven't created an account yet
DO $$
BEGIN
    -- Only set NOT NULL if all admin users have a user_id
    IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id IS NULL) THEN
        ALTER TABLE public.admin_users
            ALTER COLUMN user_id SET NOT NULL;
        RAISE NOTICE 'user_id set to NOT NULL';
    ELSE
        RAISE NOTICE 'Skipping NOT NULL constraint - admin user needs to create account first';
    END IF;
END $$;

-- Step 6: Update the is_admin() function to check by user_id
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check by user_id first (more secure)
    IF EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE user_id = (auth.jwt() ->> 'sub')::UUID
    ) THEN
        RETURN TRUE;
    END IF;

    -- Fallback to email check only if user_id is NULL (for initial setup)
    IF EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE user_id IS NULL AND email = auth.jwt() ->> 'email'
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Show final state AFTER cleanup
SELECT
    'AFTER CLEANUP' as status,
    au.id,
    au.email,
    au.user_id,
    u.email as user_table_email,
    u.id as user_id_in_users_table,
    CASE
        WHEN au.user_id IS NULL THEN 'NEEDS ACCOUNT - Create account at /signup'
        WHEN au.user_id = u.id THEN 'OK - Ready'
        ELSE 'ERROR - Mismatch'
    END as state
FROM public.admin_users au
LEFT JOIN public.users u ON u.email = au.email
ORDER BY au.created_at;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
DECLARE
    admin_count INTEGER;
    admin_email TEXT;
    has_user_id BOOLEAN;
BEGIN
    SELECT COUNT(*), MAX(email), BOOL_AND(user_id IS NOT NULL)
    INTO admin_count, admin_email, has_user_id
    FROM public.admin_users;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ADMIN CLEANUP COMPLETE';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Total admin users: %', admin_count;
    RAISE NOTICE 'Admin email: %', admin_email;

    IF admin_count = 1 AND admin_email = 'the.musashi.maru@gmail.com' THEN
        RAISE NOTICE '✓ CORRECT: Only the owner has admin access';

        IF has_user_id THEN
            RAISE NOTICE '✓ User account is linked properly';
        ELSE
            RAISE NOTICE '⚠ Admin needs to create account at /signup';
        END IF;
    ELSE
        RAISE NOTICE '✗ ERROR: Unexpected admin configuration';
    END IF;
    RAISE NOTICE '============================================================';
END $$;

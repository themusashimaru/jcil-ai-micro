-- ============================================================
-- AUTO-CREATE USER IN PUBLIC.USERS WHEN AUTH USER IS CREATED
-- ============================================================
-- This trigger ensures that when a user signs up via Supabase Auth,
-- a corresponding entry is automatically created in public.users
-- ============================================================

-- Function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        id,
        email,
        full_name,
        subscription_tier,
        subscription_status,
        is_active,
        created_at,
        updated_at,
        last_login_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
        'free', -- Default tier
        'active',
        true,
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        last_login_at = NOW(),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- BACKFILL EXISTING AUTH USERS TO PUBLIC.USERS
-- ============================================================
-- Run this once to sync existing auth.users to public.users

INSERT INTO public.users (
    id,
    email,
    full_name,
    subscription_tier,
    subscription_status,
    is_active,
    created_at,
    updated_at,
    last_login_at
)
SELECT
    id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', NULL) as full_name,
    'free' as subscription_tier,
    'active' as subscription_status,
    true as is_active,
    created_at,
    updated_at,
    COALESCE(last_sign_in_at, created_at) as last_login_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
DECLARE
    synced_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO synced_count FROM public.users;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'AUTH USER SYNC INSTALLED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✓ Trigger created: auth.users -> public.users';
    RAISE NOTICE '✓ Existing users synced: %', synced_count;
    RAISE NOTICE '✓ New signups will auto-create in public.users';
    RAISE NOTICE '============================================================';
END $$;

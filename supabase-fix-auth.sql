-- ============================================================
-- FIX: Link public.users to auth.users
-- ============================================================
-- This fixes the authentication and RLS issues

-- Step 1: Drop existing foreign key constraints that reference public.users
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
ALTER TABLE public.uploads DROP CONSTRAINT IF EXISTS uploads_user_id_fkey;
ALTER TABLE public.tool_usage DROP CONSTRAINT IF EXISTS tool_usage_user_id_fkey;
ALTER TABLE public.conversation_memory DROP CONSTRAINT IF EXISTS conversation_memory_user_id_fkey;
ALTER TABLE public.subscription_history DROP CONSTRAINT IF EXISTS subscription_history_user_id_fkey;
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_user_id_fkey;

-- Step 2: Drop the existing users table (this will CASCADE delete all related data)
-- IMPORTANT: This will delete all existing users and conversations!
-- If you have important data, back it up first!
DROP TABLE IF EXISTS public.users CASCADE;

-- Step 3: Create new users table that references auth.users
CREATE TABLE public.users (
    -- Use auth.users.id as the primary key
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT CHECK (role IN ('student', 'professional')) DEFAULT 'student',
    field TEXT,
    purpose TEXT,

    -- Subscription
    subscription_tier TEXT CHECK (subscription_tier IN ('free', 'basic', 'pro', 'executive')) DEFAULT 'free',
    subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')) DEFAULT 'active',
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,

    -- Usage tracking
    messages_used_today INTEGER DEFAULT 0,
    images_generated_today INTEGER DEFAULT 0,
    last_message_date DATE,
    total_messages INTEGER DEFAULT 0,
    total_images INTEGER DEFAULT 0,

    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_banned BOOLEAN DEFAULT false,
    ban_reason TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_subscription_tier ON public.users(subscription_tier);
CREATE INDEX idx_users_stripe_customer_id ON public.users(stripe_customer_id);
CREATE INDEX idx_users_created_at ON public.users(created_at);

-- Step 4: Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON public.users FOR INSERT
    WITH CHECK (id = auth.uid());

-- Step 6: Create trigger to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Step 7: Recreate foreign key constraints
-- Conversations
ALTER TABLE public.conversations
    ADD CONSTRAINT conversations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Messages
ALTER TABLE public.messages
    ADD CONSTRAINT messages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Uploads
ALTER TABLE public.uploads
    ADD CONSTRAINT uploads_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Tool usage
ALTER TABLE public.tool_usage
    ADD CONSTRAINT tool_usage_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Conversation memory
ALTER TABLE public.conversation_memory
    ADD CONSTRAINT conversation_memory_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Subscription history
ALTER TABLE public.subscription_history
    ADD CONSTRAINT subscription_history_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Admin users
ALTER TABLE public.admin_users
    ADD CONSTRAINT admin_users_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Step 8: Update current_user_id() function (should already be correct)
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMPLETION
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'AUTH FIX COMPLETED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '✓ public.users now references auth.users.id directly';
    RAISE NOTICE '✓ Auto-create user profile on signup (trigger)';
    RAISE NOTICE '✓ RLS policies use auth.uid()';
    RAISE NOTICE '✓ All foreign keys reconnected';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: All existing user data was deleted!';
    RAISE NOTICE 'Users need to sign up again.';
    RAISE NOTICE '============================================================';
END $$;

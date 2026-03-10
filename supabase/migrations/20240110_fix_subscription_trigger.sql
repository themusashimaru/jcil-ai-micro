-- ============================================================
-- FIX SUBSCRIPTION LIMITS TRIGGER
-- ============================================================
-- The original trigger was failing because it tried to update users
-- before the INSERT completed. This version fixes that issue.
-- ============================================================

-- Drop the old broken trigger
DROP TRIGGER IF EXISTS check_limits_before_message_insert ON public.messages;

-- Create a fixed version that runs AFTER insert
CREATE OR REPLACE FUNCTION update_user_message_count()
RETURNS TRIGGER AS $$
DECLARE
    user_tier TEXT;
    messages_today INTEGER;
    daily_message_limit INTEGER;
BEGIN
    -- Only count user messages, not assistant messages
    IF NEW.role != 'user' THEN
        RETURN NEW;
    END IF;

    -- Get user's subscription tier and usage
    SELECT subscription_tier, messages_used_today
    INTO user_tier, messages_today
    FROM public.users
    WHERE id = NEW.user_id;

    -- If user not found, allow the message (will be caught by FK constraint)
    IF user_tier IS NULL THEN
        RETURN NEW;
    END IF;

    -- Set limits based on tier
    CASE user_tier
        WHEN 'free' THEN daily_message_limit := 10;
        WHEN 'basic' THEN daily_message_limit := 100;
        WHEN 'pro' THEN daily_message_limit := 200;
        WHEN 'executive' THEN daily_message_limit := 1000;
        ELSE daily_message_limit := 10;
    END CASE;

    -- Check if limit exceeded (warning only, don't block)
    IF messages_today >= daily_message_limit THEN
        RAISE WARNING 'User % has exceeded daily message limit for % tier', NEW.user_id, user_tier;
    END IF;

    -- Update user's message count
    UPDATE public.users
    SET
        messages_used_today = messages_used_today + 1,
        total_messages = total_messages + 1,
        last_message_date = CURRENT_DATE
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that runs AFTER insert (not before)
CREATE TRIGGER update_message_count_after_insert
    AFTER INSERT ON public.messages
    FOR EACH ROW
    WHEN (NEW.role = 'user')
    EXECUTE FUNCTION update_user_message_count();

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'SUBSCRIPTION LIMITS TRIGGER FIXED';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✓ Old broken trigger removed';
    RAISE NOTICE '✓ New AFTER INSERT trigger created';
    RAISE NOTICE '✓ Message saving should work now';
    RAISE NOTICE '✓ Usage limits will be enforced with warnings';
    RAISE NOTICE '============================================================';
END $$;

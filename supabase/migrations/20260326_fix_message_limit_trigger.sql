-- Fix message limit trigger to recognize 'plus' tier (was 'basic')
CREATE OR REPLACE FUNCTION update_user_message_count()
RETURNS TRIGGER AS $$
DECLARE
    user_tier TEXT;
    messages_today INTEGER;
    daily_message_limit INTEGER;
BEGIN
    IF NEW.role != 'user' THEN
        RETURN NEW;
    END IF;

    SELECT subscription_tier, messages_used_today
    INTO user_tier, messages_today
    FROM public.users
    WHERE id = NEW.user_id;

    IF user_tier IS NULL THEN
        RETURN NEW;
    END IF;

    CASE user_tier
        WHEN 'free' THEN daily_message_limit := 10;
        WHEN 'plus' THEN daily_message_limit := 100;
        WHEN 'basic' THEN daily_message_limit := 100;
        WHEN 'pro' THEN daily_message_limit := 200;
        WHEN 'executive' THEN daily_message_limit := 1000;
        ELSE daily_message_limit := 10;
    END CASE;

    IF messages_today >= daily_message_limit THEN
        RAISE WARNING 'User % has exceeded daily message limit for % tier', NEW.user_id, user_tier;
    END IF;

    UPDATE public.users
    SET
        messages_used_today = messages_used_today + 1,
        total_messages = total_messages + 1,
        last_message_date = CURRENT_DATE
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

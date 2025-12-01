-- ============================================================
-- FIX DOUBLE COUNTING OF USER MESSAGES
-- ============================================================
-- Problem: Two triggers are both incrementing user message counts:
-- 1. check_limits_before_message_insert (BEFORE INSERT)
-- 2. update_message_count_after_insert (AFTER INSERT)
--
-- Solution: Remove the duplicate trigger and fix the counts
-- ============================================================

-- Step 1: Check which triggers currently exist on the messages table
-- Run this first to see what triggers are active
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'messages'
ORDER BY trigger_name;

-- ============================================================
-- Step 2: Drop the duplicate trigger
-- Keep only the AFTER INSERT trigger (update_message_count_after_insert)
-- which is the improved version
-- ============================================================

DROP TRIGGER IF EXISTS check_limits_before_message_insert ON public.messages;

-- Verify the function is also cleaned up if it's not used elsewhere
-- (The function check_subscription_limits may still be needed for other purposes,
-- but if you want to remove it too, uncomment the line below)
-- DROP FUNCTION IF EXISTS check_subscription_limits();

-- ============================================================
-- Step 3: Fix the doubled counts for existing users
-- Since counts were doubled, we need to halve them
-- ============================================================

-- First, preview what the fix would look like (don't run UPDATE yet)
SELECT
    id,
    email,
    messages_used_today,
    total_messages,
    messages_used_today / 2 AS corrected_messages_today,
    total_messages / 2 AS corrected_total_messages
FROM public.users
WHERE total_messages > 0
ORDER BY total_messages DESC;

-- ============================================================
-- Step 4: Apply the fix to halve the doubled counts
-- UNCOMMENT AND RUN THIS AFTER VERIFYING THE PREVIEW ABOVE
-- ============================================================

/*
UPDATE public.users
SET
    messages_used_today = messages_used_today / 2,
    total_messages = total_messages / 2
WHERE total_messages > 0;
*/

-- ============================================================
-- Step 5: Reset daily usage (if messages_used_today is accumulating)
-- This should be called daily by a scheduled job
-- ============================================================

-- Check if users have old last_message_date but non-zero messages_used_today
SELECT
    id,
    email,
    messages_used_today,
    last_message_date,
    CURRENT_DATE AS today
FROM public.users
WHERE messages_used_today > 0
  AND (last_message_date IS NULL OR last_message_date < CURRENT_DATE);

-- Reset daily counts for users who haven't been active today
UPDATE public.users
SET
    messages_used_today = 0,
    images_generated_today = 0
WHERE last_message_date IS NULL OR last_message_date < CURRENT_DATE;

-- ============================================================
-- Step 6: Set up a scheduled job to reset daily usage
-- This should run at midnight in your timezone
-- ============================================================

-- Option A: If using Supabase pg_cron extension (recommended)
-- First enable the extension if not already done:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily reset at midnight UTC
-- SELECT cron.schedule(
--     'reset-daily-usage',           -- job name
--     '0 0 * * *',                   -- cron schedule (midnight UTC)
--     $$UPDATE public.users SET messages_used_today = 0, images_generated_today = 0 WHERE last_message_date < CURRENT_DATE$$
-- );

-- Option B: Manual function to call from your app
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS void AS $$
BEGIN
    UPDATE public.users
    SET
        messages_used_today = 0,
        images_generated_today = 0
    WHERE last_message_date IS NULL OR last_message_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Step 7: Verify the fix worked
-- ============================================================

-- Check triggers again - should only see one message counting trigger
SELECT
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'messages'
  AND trigger_name LIKE '%message%'
ORDER BY trigger_name;

-- Check current user stats
SELECT
    id,
    email,
    messages_used_today,
    total_messages,
    last_message_date
FROM public.users
ORDER BY total_messages DESC
LIMIT 20;

-- ============================================================
-- SUMMARY:
-- 1. Run the DROP TRIGGER statement (Step 2)
-- 2. Review the preview in Step 3
-- 3. If counts look doubled, uncomment and run the UPDATE in Step 4
-- 4. Run the daily reset in Step 5
-- 5. Optionally set up pg_cron for automatic daily resets (Step 6)
-- ============================================================

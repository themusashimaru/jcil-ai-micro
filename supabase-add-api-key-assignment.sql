-- ============================================================
-- ADD API KEY ASSIGNMENT TO USERS TABLE
-- ============================================================
-- Purpose: Store which API key index each user is assigned to
-- This enables load distribution across multiple xAI API keys
-- ============================================================

-- Step 1: Add the column for API key assignment
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS assigned_api_key_index INTEGER DEFAULT NULL;

-- Step 2: Add an index for querying users by their assigned key
CREATE INDEX IF NOT EXISTS idx_users_assigned_api_key
ON public.users(assigned_api_key_index);

-- Step 3: Create a function to get the next API key index (round-robin)
-- This finds the highest currently assigned index and returns the next one
CREATE OR REPLACE FUNCTION get_next_api_key_index(max_keys INTEGER)
RETURNS INTEGER AS $$
DECLARE
    current_max INTEGER;
    next_index INTEGER;
BEGIN
    -- Get the highest assigned index, default to 0 if none assigned
    SELECT COALESCE(MAX(assigned_api_key_index), 0)
    INTO current_max
    FROM public.users
    WHERE assigned_api_key_index IS NOT NULL;

    -- Calculate next index (round-robin)
    next_index := (current_max % max_keys) + 1;

    RETURN next_index;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create a function to assign API key to a user
-- This is called when a user first sends a chat message
CREATE OR REPLACE FUNCTION assign_user_api_key(
    p_user_id UUID,
    p_max_keys INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    current_assignment INTEGER;
    new_index INTEGER;
BEGIN
    -- Check if user already has an assignment
    SELECT assigned_api_key_index
    INTO current_assignment
    FROM public.users
    WHERE id = p_user_id;

    -- If already assigned, return existing assignment
    IF current_assignment IS NOT NULL THEN
        RETURN current_assignment;
    END IF;

    -- Get next index using round-robin
    new_index := get_next_api_key_index(p_max_keys);

    -- Assign to user
    UPDATE public.users
    SET assigned_api_key_index = new_index
    WHERE id = p_user_id;

    RETURN new_index;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Grant execute permissions
GRANT EXECUTE ON FUNCTION get_next_api_key_index(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_user_api_key(UUID, INTEGER) TO authenticated;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'assigned_api_key_index';

-- Check distribution of users across API keys (run after users are assigned)
-- SELECT
--     assigned_api_key_index,
--     COUNT(*) as user_count
-- FROM public.users
-- WHERE assigned_api_key_index IS NOT NULL
-- GROUP BY assigned_api_key_index
-- ORDER BY assigned_api_key_index;

-- ============================================================
-- USAGE NOTES
-- ============================================================
/*
1. Run this SQL in Supabase SQL Editor

2. The system will automatically assign API keys to users:
   - First user → API key 1
   - Second user → API key 2
   - ... continues round-robin
   - After key N, wraps back to key 1

3. Users keep their assigned key permanently for consistency

4. To add more API keys:
   - Add XAI_API_KEY_N to Vercel environment variables
   - New users will be distributed across all keys
   - Existing users keep their current assignment

5. To rebalance users (optional):
   - UPDATE public.users SET assigned_api_key_index = NULL;
   - Users will be reassigned on next chat message
*/

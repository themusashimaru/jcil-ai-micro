-- ============================================
-- DAILY DEVOTIONALS TABLE
-- ============================================
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This table stores the daily devotional content that is shared across all users

-- Create the daily_devotionals table
CREATE TABLE IF NOT EXISTS daily_devotionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_key TEXT NOT NULL UNIQUE, -- YYYY-MM-DD format (e.g., "2025-01-15")
  content TEXT NOT NULL, -- The devotional content in markdown format
  generated_at TIMESTAMPTZ NOT NULL, -- When the devotional was generated
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index on date_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_daily_devotionals_date_key
ON daily_devotionals (date_key);

-- Add comment to table
COMMENT ON TABLE daily_devotionals IS 'Stores daily devotional content that is shared across all users. One devotional per day.';

-- ============================================
-- VERIFY TABLE WAS CREATED
-- ============================================
-- Run this query to confirm the table exists:
-- SELECT * FROM daily_devotionals LIMIT 1;

-- ============================================
-- NOTES
-- ============================================
-- 1. Each day has exactly ONE devotional (enforced by UNIQUE constraint on date_key)
-- 2. All users see the same devotional for any given day
-- 3. Devotionals are generated on-demand when first requested
-- 4. Content is stored in markdown format for rich text rendering
-- 5. The date_key uses YYYY-MM-DD format in UTC timezone

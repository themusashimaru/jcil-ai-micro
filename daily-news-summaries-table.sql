-- ============================================
-- DAILY NEWS SUMMARIES TABLE
-- ============================================
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This table stores conservative Christian news summaries updated every 30 minutes

-- Create the daily_news_summaries table
CREATE TABLE IF NOT EXISTS daily_news_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp_key TEXT NOT NULL UNIQUE, -- Format: YYYY-MM-DD-HH-MM (30-min intervals)
  content JSONB NOT NULL, -- Structured news data with all categories
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index on timestamp_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_daily_news_summaries_timestamp_key
ON daily_news_summaries (timestamp_key);

-- Create index on generated_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_daily_news_summaries_generated_at
ON daily_news_summaries (generated_at);

-- Add comment to table
COMMENT ON TABLE daily_news_summaries IS 'Stores conservative Christian news summaries updated every 30 minutes. Aggregated from verified sources and summarized by Claude Sonnet 4.5.';

-- ============================================
-- CONTENT STRUCTURE (JSONB)
-- ============================================
/*
{
  "generated_at": "2025-01-15T14:30:00Z",
  "categories": {
    "us_breaking": {
      "title": "U.S. Breaking News",
      "articles": [
        {
          "headline": "...",
          "summary": "...",
          "source": "...",
          "url": "..."
        }
      ]
    },
    "international": { ... },
    "economics": { ... },
    "national_defense": { ... },
    "espionage": { ... },
    "christian_persecution": { ... },
    "china": { ... },
    "russia": { ... },
    "iran": { ... },
    "north_korea": { ... }
  }
}
*/

-- ============================================
-- CLEANUP OLD SUMMARIES (Optional)
-- ============================================
-- Keep only last 7 days of summaries
-- Run this as a scheduled job or manually

-- DELETE FROM daily_news_summaries
-- WHERE generated_at < NOW() - INTERVAL '7 days';

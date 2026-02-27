-- ============================================================
-- MIGRATION: Add rate_limits table
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Create the rate_limits table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- User ID or IP address
    action TEXT NOT NULL, -- 'chat_message', 'support_ticket', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by identifier and action within time window
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_action
    ON public.rate_limits(identifier, action);
CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at
    ON public.rate_limits(created_at);

-- Auto-cleanup function for old rate limit records (older than 2 hours)
-- This keeps the table small and fast
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM public.rate_limits
    WHERE created_at < NOW() - INTERVAL '2 hours';
END;
$$ LANGUAGE plpgsql;

-- Grant access to all roles that need it
GRANT ALL ON public.rate_limits TO authenticated;
GRANT ALL ON public.rate_limits TO service_role;
GRANT ALL ON public.rate_limits TO anon;

-- RLS Policy: Allow service role to manage all rate limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Allow inserts from anyone (needed for rate limiting)
CREATE POLICY "Allow rate limit inserts" ON public.rate_limits
    FOR INSERT TO anon, authenticated, service_role
    WITH CHECK (true);

-- Policy: Allow selects for rate limit checking
CREATE POLICY "Allow rate limit reads" ON public.rate_limits
    FOR SELECT TO anon, authenticated, service_role
    USING (true);

-- Policy: Allow deletes for cleanup
CREATE POLICY "Allow rate limit deletes" ON public.rate_limits
    FOR DELETE TO service_role
    USING (true);

-- Verification
DO $$
BEGIN
    RAISE NOTICE 'rate_limits table created successfully!';
    RAISE NOTICE 'Consider setting up a cron job to run cleanup_old_rate_limits() hourly.';
END $$;

-- Pending Requests Table
-- Tracks chat requests that are in progress, so background workers can complete them if user leaves

CREATE TABLE IF NOT EXISTS public.pending_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL,

    -- The request details needed to complete the request
    messages JSONB NOT NULL,  -- The conversation messages array
    tool TEXT,                -- Tool context (research, shopper, etc.)
    model TEXT,               -- Model to use

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,     -- When a worker picked it up
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Result storage (for completed requests)
    response_content TEXT,
    response_model TEXT,
    error_message TEXT
);

-- Index for finding pending requests to process
CREATE INDEX IF NOT EXISTS idx_pending_requests_status ON public.pending_requests(status, created_at);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_pending_requests_user ON public.pending_requests(user_id);

-- Index for conversation lookups
CREATE INDEX IF NOT EXISTS idx_pending_requests_conversation ON public.pending_requests(conversation_id);

-- RLS policies
ALTER TABLE public.pending_requests ENABLE ROW LEVEL SECURITY;

-- Users can only see their own pending requests
CREATE POLICY "Users can view own pending requests" ON public.pending_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own pending requests
CREATE POLICY "Users can insert own pending requests" ON public.pending_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending requests
CREATE POLICY "Users can update own pending requests" ON public.pending_requests
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own pending requests
CREATE POLICY "Users can delete own pending requests" ON public.pending_requests
    FOR DELETE USING (auth.uid() = user_id);

-- Service role can do everything (for background worker)
CREATE POLICY "Service role full access" ON public.pending_requests
    FOR ALL USING (auth.role() = 'service_role');

-- Auto-cleanup: Delete completed requests older than 1 hour
-- (This would be run by a scheduled job, not automatically by Postgres)
COMMENT ON TABLE public.pending_requests IS 'Tracks in-progress chat requests for background completion. Cleanup: DELETE FROM pending_requests WHERE status IN (''completed'', ''failed'') AND created_at < NOW() - INTERVAL ''1 hour''';

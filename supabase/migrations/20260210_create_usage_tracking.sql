-- Migration 4: Create usage_tracking table
-- This table is required for token usage billing and the admin earnings dashboard.
-- It was referenced by indexes and admin routes but never had a CREATE TABLE.

CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    model_name TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    cached_input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    live_search_calls INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    source TEXT DEFAULT 'unknown',
    conversation_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes (may already exist from prior migration, IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_usage_tracking_created
ON usage_tracking(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_created
ON usage_tracking(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_model
ON usage_tracking(model_name, created_at DESC);

-- RLS: Users can only read their own usage, service role can write
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read own usage"
ON public.usage_tracking FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service role can insert usage"
ON public.usage_tracking FOR INSERT
WITH CHECK (true);

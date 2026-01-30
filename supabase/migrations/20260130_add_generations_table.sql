-- =============================================================================
-- GENERATIONS TABLE
-- =============================================================================
-- Tracks AI-generated content (images, slides) using Black Forest Labs FLUX
-- and other generation providers.
--
-- This table stores:
-- - Generation metadata (prompt, model, dimensions)
-- - Status tracking for async generation
-- - Cost tracking for billing
-- - Links to stored assets in Supabase Storage
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.generations (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User association
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,

    -- Generation type and model
    type TEXT NOT NULL CHECK (type IN ('image', 'edit', 'slides', 'video')),
    model TEXT NOT NULL,  -- e.g., 'flux-2-pro', 'flux-2-max'
    provider TEXT NOT NULL DEFAULT 'bfl',  -- 'bfl' for Black Forest Labs

    -- Input data
    prompt TEXT NOT NULL,
    input_data JSONB DEFAULT '{}',  -- Additional params (images, dimensions, etc.)

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'moderated')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

    -- Provider-specific tracking
    provider_request_id TEXT,  -- BFL request ID
    polling_url TEXT,          -- BFL polling URL

    -- Result storage
    result_url TEXT,           -- Supabase Storage URL (permanent)
    result_data JSONB,         -- Additional result metadata (seed, enhanced prompt, etc.)

    -- Cost tracking
    cost_credits DECIMAL(10, 6),  -- Cost in credits/USD
    dimensions JSONB,             -- { "width": 1024, "height": 1024 }

    -- Error handling
    error_code TEXT,
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- User's generations (most common query)
CREATE INDEX IF NOT EXISTS idx_generations_user_created
    ON public.generations(user_id, created_at DESC);

-- Status-based queries for processing
CREATE INDEX IF NOT EXISTS idx_generations_status
    ON public.generations(status, created_at)
    WHERE status IN ('pending', 'processing');

-- Conversation context
CREATE INDEX IF NOT EXISTS idx_generations_conversation
    ON public.generations(conversation_id)
    WHERE conversation_id IS NOT NULL;

-- Provider request ID lookup
CREATE INDEX IF NOT EXISTS idx_generations_provider_request
    ON public.generations(provider_request_id)
    WHERE provider_request_id IS NOT NULL;

-- Type-based queries
CREATE INDEX IF NOT EXISTS idx_generations_type
    ON public.generations(user_id, type, created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- Users can view their own generations
CREATE POLICY "Users can view own generations"
    ON public.generations
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own generations
CREATE POLICY "Users can create own generations"
    ON public.generations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own generations (for cancellation)
CREATE POLICY "Users can update own generations"
    ON public.generations
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own generations
CREATE POLICY "Users can delete own generations"
    ON public.generations
    FOR DELETE
    USING (auth.uid() = user_id);

-- Service role has full access (for background processing)
CREATE POLICY "Service role full access to generations"
    ON public.generations
    FOR ALL
    USING (auth.role() = 'service_role');

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_generations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generations_updated_at
    BEFORE UPDATE ON public.generations
    FOR EACH ROW
    EXECUTE FUNCTION update_generations_updated_at();

-- =============================================================================
-- STORAGE BUCKET
-- =============================================================================

-- Create storage bucket for generated content (if not exists)
-- Note: Run this in Supabase Dashboard or via supabase CLI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('generations', 'generations', true);

COMMENT ON TABLE public.generations IS 'Tracks AI-generated content (images, slides). Clean up orphaned records: DELETE FROM generations WHERE status = ''pending'' AND created_at < NOW() - INTERVAL ''1 hour''';

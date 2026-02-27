-- User Learning Table
-- Stores learned user preferences for personalization
-- STYLE ONLY - never overrides faith content

CREATE TABLE IF NOT EXISTS public.user_learning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Preference classification
    preference_type TEXT NOT NULL CHECK (preference_type IN (
        'format_style',        -- bullets, paragraphs, headers, etc.
        'response_length',     -- concise, detailed, comprehensive
        'communication_tone',  -- formal, casual, professional
        'domain_expertise',    -- tech, finance, medical, legal, etc.
        'topic_interest',      -- recurring topics they ask about
        'output_preference'    -- code examples, step-by-step, etc.
    )),

    -- The actual preference value
    preference_value TEXT NOT NULL,

    -- Confidence scoring (0.0 - 1.0)
    -- Increases with repeated observations
    confidence DECIMAL(3,2) NOT NULL DEFAULT 0.40 CHECK (confidence >= 0 AND confidence <= 1),

    -- How many times we've observed this preference
    observation_count INTEGER NOT NULL DEFAULT 1,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint: one preference value per type per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_learning_unique
    ON public.user_learning(user_id, preference_type, preference_value);

-- Index for quick lookups by user + confidence
CREATE INDEX IF NOT EXISTS idx_user_learning_user_confidence
    ON public.user_learning(user_id, confidence DESC);

-- Index for cleanup queries (low confidence preferences)
CREATE INDEX IF NOT EXISTS idx_user_learning_confidence
    ON public.user_learning(confidence);

-- RLS policies
ALTER TABLE public.user_learning ENABLE ROW LEVEL SECURITY;

-- Users can view their own learning data
CREATE POLICY "Users can view own learning" ON public.user_learning
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all (for backend learning system)
CREATE POLICY "Service role can manage learning" ON public.user_learning
    FOR ALL USING (auth.role() = 'service_role');

-- Users can delete their own learning data (privacy)
CREATE POLICY "Users can delete own learning" ON public.user_learning
    FOR DELETE USING (auth.uid() = user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_learning_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_user_learning_updated_at ON public.user_learning;
CREATE TRIGGER update_user_learning_updated_at
    BEFORE UPDATE ON public.user_learning
    FOR EACH ROW
    EXECUTE FUNCTION update_user_learning_updated_at();

-- Cleanup function: Remove low-confidence preferences older than 30 days
-- Run this periodically via Supabase scheduled function or cron
CREATE OR REPLACE FUNCTION cleanup_low_confidence_learning()
RETURNS void AS $$
BEGIN
    DELETE FROM public.user_learning
    WHERE confidence < 0.3
      AND updated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON TABLE public.user_learning IS 'Stores learned user style preferences. NEVER contains or overrides faith/belief content.';

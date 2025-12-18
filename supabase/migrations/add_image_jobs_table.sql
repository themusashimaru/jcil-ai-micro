-- Image Jobs Table
-- Tracks async image generation jobs for Nano Banana (Gemini image generation)
-- Needed for serverless environments where in-memory storage doesn't persist

CREATE TABLE IF NOT EXISTS public.image_jobs (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Job details
    prompt TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'image' or 'slide'
    model TEXT NOT NULL,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Result storage (for completed jobs)
    result_image_data TEXT,      -- Base64 encoded image
    result_mime_type TEXT,
    result_content TEXT,         -- Response text
    error_message TEXT
);

-- Index for finding jobs by status
CREATE INDEX IF NOT EXISTS idx_image_jobs_status ON public.image_jobs(status, created_at);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_image_jobs_user ON public.image_jobs(user_id);

-- RLS policies
ALTER TABLE public.image_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own image jobs" ON public.image_jobs
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own jobs
CREATE POLICY "Users can insert own image jobs" ON public.image_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own jobs
CREATE POLICY "Users can delete own image jobs" ON public.image_jobs
    FOR DELETE USING (auth.uid() = user_id);

-- Service role can do everything (for background processing)
CREATE POLICY "Service role full access to image jobs" ON public.image_jobs
    FOR ALL USING (auth.role() = 'service_role');

-- Auto-cleanup: Delete old jobs (run as scheduled job)
COMMENT ON TABLE public.image_jobs IS 'Tracks async image generation jobs. Cleanup: DELETE FROM image_jobs WHERE created_at < NOW() - INTERVAL ''10 minutes''';

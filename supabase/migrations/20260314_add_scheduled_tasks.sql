-- ============================================================================
-- SCHEDULED TASKS TABLE
-- Stores user-created scheduled/recurring tasks for automated execution.
-- Tasks are created via chat ("send weekly report every Monday") or sidebar UI.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Task definition
    name TEXT NOT NULL,                    -- "Weekly Sales Report Email"
    description TEXT,                      -- Longer description
    platform TEXT NOT NULL,                -- "gmail", "calendar", "slack", etc.
    action TEXT NOT NULL,                  -- "Send Email", "Create Event", etc.
    tool_name TEXT NOT NULL,               -- "composio_GMAIL_SEND_EMAIL"
    tool_params JSONB NOT NULL DEFAULT '{}', -- Parameters for the tool

    -- Schedule
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,  -- Next execution time
    timezone TEXT NOT NULL DEFAULT 'UTC',
    recurring TEXT CHECK (recurring IN ('once', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
    cron_expression TEXT,                  -- Optional cron for complex schedules

    -- State
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused', 'cancelled')),
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_result TEXT,                      -- Brief result summary
    last_error TEXT,                       -- Error message if failed
    run_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,

    -- Metadata
    created_from TEXT DEFAULT 'chat',      -- 'chat' or 'sidebar'
    conversation_id UUID,                  -- Which chat created this task
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scheduled_tasks_user_id ON public.scheduled_tasks(user_id);
CREATE INDEX idx_scheduled_tasks_status ON public.scheduled_tasks(status);
CREATE INDEX idx_scheduled_tasks_scheduled_for ON public.scheduled_tasks(scheduled_for);
CREATE INDEX idx_scheduled_tasks_user_status ON public.scheduled_tasks(user_id, status);

-- RLS
ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled tasks"
    ON public.scheduled_tasks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create scheduled tasks"
    ON public.scheduled_tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled tasks"
    ON public.scheduled_tasks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled tasks"
    ON public.scheduled_tasks FOR DELETE
    USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_scheduled_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scheduled_tasks_updated_at
    BEFORE UPDATE ON public.scheduled_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_tasks_updated_at();

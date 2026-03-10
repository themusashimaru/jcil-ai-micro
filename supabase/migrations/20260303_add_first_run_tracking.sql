-- Track whether users have completed the first-run onboarding flow.
-- Enables showing a welcome modal only on first visit.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS first_run_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS first_run_completed_at TIMESTAMP WITH TIME ZONE;

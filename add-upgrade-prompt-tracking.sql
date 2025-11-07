-- ============================================
-- UPGRADE PROMPT TRACKING TABLE
-- ============================================
-- This table tracks when we show upgrade prompts to paid tier users
-- to ensure we only show them twice per month

CREATE TABLE IF NOT EXISTS public.upgrade_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_tier TEXT NOT NULL, -- current tier (basic, pro, premium)
  to_tier TEXT NOT NULL, -- target tier to upgrade to
  shown_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  clicked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by user_id and date
CREATE INDEX IF NOT EXISTS idx_upgrade_prompts_user_date ON public.upgrade_prompts(user_id, shown_at DESC);

-- ============================================
-- FUNCTION: Check if user should see upgrade prompt
-- ============================================
-- Returns TRUE if user should see an upgrade prompt (max 2 times per month)

CREATE OR REPLACE FUNCTION public.should_show_upgrade_prompt(
  p_user_id UUID,
  p_from_tier TEXT,
  p_to_tier TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prompt_count INTEGER;
  v_current_month_start DATE;
BEGIN
  -- Get first day of current month
  v_current_month_start := DATE_TRUNC('month', NOW());

  -- Count how many times we've shown this prompt this month
  SELECT COUNT(*)
  INTO v_prompt_count
  FROM public.upgrade_prompts
  WHERE user_id = p_user_id
    AND from_tier = p_from_tier
    AND to_tier = p_to_tier
    AND shown_at >= v_current_month_start;

  -- Return TRUE if we've shown less than 2 prompts this month
  RETURN v_prompt_count < 2;
END;
$$;

-- ============================================
-- FUNCTION: Record upgrade prompt shown
-- ============================================

CREATE OR REPLACE FUNCTION public.record_upgrade_prompt(
  p_user_id UUID,
  p_from_tier TEXT,
  p_to_tier TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prompt_id UUID;
BEGIN
  -- Insert new prompt record
  INSERT INTO public.upgrade_prompts (user_id, from_tier, to_tier, shown_at)
  VALUES (p_user_id, p_from_tier, p_to_tier, NOW())
  RETURNING id INTO v_prompt_id;

  RETURN v_prompt_id;
END;
$$;

-- ============================================
-- FUNCTION: Record upgrade prompt click
-- ============================================

CREATE OR REPLACE FUNCTION public.record_upgrade_click(
  p_prompt_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.upgrade_prompts
  SET clicked = TRUE
  WHERE id = p_prompt_id;

  RETURN TRUE;
END;
$$;

-- Enable Row Level Security
ALTER TABLE public.upgrade_prompts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own prompts
CREATE POLICY "Users can view own upgrade prompts"
  ON public.upgrade_prompts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert prompts (for API)
CREATE POLICY "Service role can insert upgrade prompts"
  ON public.upgrade_prompts
  FOR INSERT
  WITH CHECK (true);

-- Policy: Service role can update prompts (for API)
CREATE POLICY "Service role can update upgrade prompts"
  ON public.upgrade_prompts
  FOR UPDATE
  USING (true);

COMMENT ON TABLE public.upgrade_prompts IS 'Tracks when upgrade prompts are shown to users to enforce 2-per-month limit';
COMMENT ON COLUMN public.upgrade_prompts.from_tier IS 'Current subscription tier of the user';
COMMENT ON COLUMN public.upgrade_prompts.to_tier IS 'Target tier being promoted';
COMMENT ON COLUMN public.upgrade_prompts.shown_at IS 'When the prompt was shown to the user';
COMMENT ON COLUMN public.upgrade_prompts.clicked IS 'Whether the user clicked the upgrade link';

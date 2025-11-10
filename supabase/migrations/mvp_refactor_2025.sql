ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS education_level TEXT,
ADD COLUMN IF NOT EXISTS job_role TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_education ON public.user_profiles(education_level) WHERE education_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_job_role ON public.user_profiles(job_role) WHERE job_role IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_profile_personalization_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.education_level IS DISTINCT FROM OLD.education_level OR
      NEW.job_role IS DISTINCT FROM OLD.job_role) THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_personalization_update ON public.user_profiles;
CREATE TRIGGER on_profile_personalization_update
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_personalization_timestamp();

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.message_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  image_data TEXT NOT NULL,
  media_type TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  flagged BOOLEAN DEFAULT FALSE,
  categories TEXT[],
  severity TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own messages" ON public.messages;
CREATE POLICY "Users can insert own messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON public.conversations;
CREATE POLICY "Users can insert own conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own images" ON public.message_images;
CREATE POLICY "Users can view own images"
  ON public.message_images FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own images" ON public.message_images;
CREATE POLICY "Users can insert own images"
  ON public.message_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own images" ON public.message_images;
CREATE POLICY "Users can delete own images"
  ON public.message_images FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_images_message_id ON public.message_images(message_id);
CREATE INDEX IF NOT EXISTS idx_message_images_user_id ON public.message_images(user_id);
CREATE INDEX IF NOT EXISTS idx_message_images_conversation_id ON public.message_images(conversation_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id ON public.moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON public.moderation_logs(created_at DESC);

CREATE OR REPLACE FUNCTION public.check_daily_limit(p_user_id UUID)
RETURNS TABLE (
  has_remaining BOOLEAN,
  current_count INTEGER,
  daily_limit INTEGER,
  tier TEXT
) AS $$
DECLARE
  v_tier TEXT;
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  SELECT subscription_tier INTO v_tier
  FROM public.user_profiles
  WHERE id = p_user_id;

  v_tier := COALESCE(v_tier, 'free');

  v_limit := CASE v_tier
    WHEN 'free' THEN 10
    WHEN 'basic' THEN 120
    WHEN 'pro' THEN 250
    WHEN 'executive' THEN 1000
    ELSE 10
  END;

  SELECT COUNT(*) INTO v_count
  FROM public.messages
  WHERE user_id = p_user_id
    AND role = 'user'
    AND created_at >= CURRENT_DATE;

  RETURN QUERY SELECT
    (v_count < v_limit) AS has_remaining,
    v_count::INTEGER AS current_count,
    v_limit AS daily_limit,
    v_tier AS tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_message_count(
  p_user_id UUID,
  p_token_count INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    total_messages = COALESCE(total_messages, 0) + 1,
    total_tokens = COALESCE(total_tokens, 0) + p_token_count,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_api_key_stats(
  p_key_group INTEGER,
  p_tokens INTEGER
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.api_key_stats (key_group, requests, tokens, last_used)
  VALUES (p_key_group, 1, p_tokens, NOW())
  ON CONFLICT (key_group)
  DO UPDATE SET
    requests = api_key_stats.requests + 1,
    tokens = api_key_stats.tokens + p_tokens,
    last_used = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.api_key_stats (
  key_group INTEGER PRIMARY KEY,
  requests INTEGER DEFAULT 0,
  tokens INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ DEFAULT NOW()
);

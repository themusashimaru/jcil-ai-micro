-- ============================================
-- MESSAGE IMAGES TABLE
-- ============================================
-- Store uploaded images separately from messages to avoid
-- storing large base64 data in the messages table

CREATE TABLE IF NOT EXISTS public.message_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  image_data TEXT NOT NULL, -- base64 encoded image
  media_type TEXT NOT NULL, -- image/jpeg, image/png, etc.
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.message_images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own images
CREATE POLICY "Users can view own images"
  ON public.message_images
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own images
CREATE POLICY "Users can insert own images"
  ON public.message_images
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own images
CREATE POLICY "Users can delete own images"
  ON public.message_images
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_images_message_id ON public.message_images(message_id);
CREATE INDEX IF NOT EXISTS idx_message_images_user_id ON public.message_images(user_id);
CREATE INDEX IF NOT EXISTS idx_message_images_conversation_id ON public.message_images(conversation_id);

-- Comments
COMMENT ON TABLE public.message_images IS 'Stores uploaded images separately from messages to avoid database size issues';
COMMENT ON COLUMN public.message_images.image_data IS 'Base64 encoded image data';
COMMENT ON COLUMN public.message_images.media_type IS 'MIME type of the image (image/jpeg, image/png, etc.)';

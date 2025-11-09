-- ============================================
-- COPY AND PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR
-- ============================================

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_images_message_id ON message_images(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_user ON messages(conversation_id, user_id);

-- Update statistics
ANALYZE messages;
ANALYZE conversations;
ANALYZE message_images;
ANALYZE user_profiles;

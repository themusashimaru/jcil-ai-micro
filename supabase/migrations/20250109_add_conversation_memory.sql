-- Conversation Memory Table for Persistent Memory Agent
-- Stores user context across conversations for personalized AI experiences

CREATE TABLE IF NOT EXISTS conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary TEXT DEFAULT '',
  key_topics TEXT[] DEFAULT '{}',
  user_preferences JSONB DEFAULT '{}',
  conversation_ids TEXT[] DEFAULT '{}',
  last_conversations TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_conversation_memory_user_id ON conversation_memory(user_id);

-- Index for cleanup queries (unused memories)
CREATE INDEX IF NOT EXISTS idx_conversation_memory_last_accessed ON conversation_memory(last_accessed_at);

-- Enable RLS
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own memory
CREATE POLICY "Users can view their own memory"
  ON conversation_memory
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memory"
  ON conversation_memory
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memory"
  ON conversation_memory
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memory"
  ON conversation_memory
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass for backend operations
CREATE POLICY "Service role can manage all memories"
  ON conversation_memory
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Comment for documentation
COMMENT ON TABLE conversation_memory IS 'Stores persistent user memory for personalized AI conversations';
COMMENT ON COLUMN conversation_memory.summary IS 'Overall summary of user context';
COMMENT ON COLUMN conversation_memory.key_topics IS 'Topics the user has discussed';
COMMENT ON COLUMN conversation_memory.user_preferences IS 'Extracted user preferences (name, occupation, etc)';
COMMENT ON COLUMN conversation_memory.last_conversations IS 'Recent conversation summaries';

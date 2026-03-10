-- ============================================
-- MESSAGE EDIT FEATURE MIGRATION
-- ============================================
-- Adds support for message editing and regeneration

-- Add edited_at column to track when messages were edited
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

-- Add original_content column to store the original content before edit
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS original_content TEXT DEFAULT NULL;

-- Add is_regenerated flag to track regenerated assistant messages
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS is_regenerated BOOLEAN DEFAULT FALSE;

-- Add regeneration_count to track how many times a message was regenerated
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS regeneration_count INTEGER DEFAULT 0;

-- Index for finding edited messages (for audit/analytics)
CREATE INDEX IF NOT EXISTS idx_messages_edited_at ON messages(edited_at)
WHERE edited_at IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN messages.edited_at IS 'Timestamp when the message was last edited';
COMMENT ON COLUMN messages.original_content IS 'Original content before editing (for audit purposes)';
COMMENT ON COLUMN messages.is_regenerated IS 'Whether this assistant message was regenerated';
COMMENT ON COLUMN messages.regeneration_count IS 'Number of times this message was regenerated';

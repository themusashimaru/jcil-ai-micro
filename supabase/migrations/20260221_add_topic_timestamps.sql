-- Add topic_timestamps JSONB column to conversation_memory
-- Maps topic names to ISO timestamps for temporal relevance weighting.
-- Keeps existing key_topics TEXT[] for backward compatibility.

ALTER TABLE conversation_memory
  ADD COLUMN IF NOT EXISTS topic_timestamps JSONB DEFAULT '{}';

COMMENT ON COLUMN conversation_memory.topic_timestamps IS
  'Maps topic name → ISO timestamp of when the topic was last discussed, enabling temporal relevance weighting';

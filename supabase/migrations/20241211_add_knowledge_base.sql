-- =============================================
-- KNOWLEDGE BASE FOR AI PROMPT CONTENT
-- =============================================
-- Stores modular prompt content that can be loaded on-demand
-- based on conversation topic. Reduces token usage by ~90%.
-- =============================================

-- Main knowledge base table
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Categorization
  category TEXT NOT NULL,           -- 'apologetics', 'pastoral', 'cults', 'worldview', etc.
  subcategory TEXT,                 -- 'mormonism', 'suicide', 'trinity', etc.

  -- Content
  title TEXT NOT NULL,              -- Human-readable title for admin
  content TEXT NOT NULL,            -- The actual prompt content

  -- Matching
  keywords TEXT[] NOT NULL DEFAULT '{}',  -- Keywords that trigger this content
  priority INT NOT NULL DEFAULT 100,       -- Lower = higher priority (loaded first)

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  token_estimate INT,               -- Approximate token count
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast keyword matching
CREATE INDEX IF NOT EXISTS idx_kb_keywords ON knowledge_base USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base (category);
CREATE INDEX IF NOT EXISTS idx_kb_active ON knowledge_base (is_active) WHERE is_active = true;

-- Function to search knowledge base by keywords
CREATE OR REPLACE FUNCTION search_knowledge_base(search_terms TEXT[])
RETURNS SETOF knowledge_base AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM knowledge_base
  WHERE is_active = true
    AND keywords && search_terms  -- Array overlap operator
  ORDER BY priority ASC, category ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get knowledge base by category
CREATE OR REPLACE FUNCTION get_kb_by_category(cat TEXT)
RETURNS SETOF knowledge_base AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM knowledge_base
  WHERE is_active = true
    AND category = cat
  ORDER BY priority ASC;
END;
$$ LANGUAGE plpgsql;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_kb_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kb_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_kb_timestamp();

-- RLS Policies (read-only for all, write for service role only)
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Anyone can read active entries
CREATE POLICY "Knowledge base is publicly readable"
  ON knowledge_base FOR SELECT
  USING (is_active = true);

-- Comments
COMMENT ON TABLE knowledge_base IS 'Modular AI prompt content loaded on-demand based on conversation topic';
COMMENT ON COLUMN knowledge_base.category IS 'Main category: apologetics, pastoral, cults, worldview, technical, etc.';
COMMENT ON COLUMN knowledge_base.keywords IS 'Array of keywords that trigger loading this content';
COMMENT ON COLUMN knowledge_base.priority IS 'Load order - lower numbers load first';

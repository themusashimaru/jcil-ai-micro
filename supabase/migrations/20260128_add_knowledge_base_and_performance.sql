-- =============================================================================
-- DEEP AGENT ENHANCEMENTS: Knowledge Base + Scout Performance + Artifacts
-- =============================================================================
-- Adds persistent memory, performance learning, and artifact storage.
--
-- NOTE: pg_trgm extension is optional. If it fails, fuzzy search index
-- is simply skipped. Core functionality works without it.
-- NOTE: pgvector is NOT used. Embedding column can be added later.

-- Try to enable pg_trgm (optional — won't block if unavailable)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm extension not available, skipping fuzzy search index';
END;
$$;

-- =============================================================================
-- 1. KNOWLEDGE BASE - Persistent findings across sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    agent_mode TEXT NOT NULL DEFAULT 'strategy',

    -- Finding data
    finding_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'medium',
    relevance_score REAL DEFAULT 0.5,

    -- Source tracking
    sources JSONB DEFAULT '[]'::jsonb,
    data_points JSONB DEFAULT '[]'::jsonb,

    -- Research context
    domain TEXT,
    topic_tags TEXT[] DEFAULT '{}',
    search_queries TEXT[] DEFAULT '{}',

    -- Full-text search
    search_vector tsvector,

    -- Scout metadata
    scout_name TEXT,
    scout_tools_used TEXT[] DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_kb_search_vector ON knowledge_base USING gin(search_vector);

-- User + mode index
CREATE INDEX IF NOT EXISTS idx_kb_user_mode ON knowledge_base(user_id, agent_mode);

-- Domain index
CREATE INDEX IF NOT EXISTS idx_kb_domain ON knowledge_base(user_id, domain);

-- Topic tags index
CREATE INDEX IF NOT EXISTS idx_kb_tags ON knowledge_base USING gin(topic_tags);

-- Trigram index (optional — only if pg_trgm is available)
DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_kb_title_trgm ON knowledge_base USING gin(title gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping trigram index (pg_trgm not available)';
END;
$$;

-- Auto-update search vector on insert/update
CREATE OR REPLACE FUNCTION update_kb_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.title, '') || ' ' ||
        COALESCE(NEW.content, '') || ' ' ||
        COALESCE(NEW.domain, '') || ' ' ||
        COALESCE(array_to_string(NEW.topic_tags, ' '), '')
    );
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_kb_search_vector ON knowledge_base;
CREATE TRIGGER trigger_kb_search_vector
    BEFORE INSERT OR UPDATE ON knowledge_base
    FOR EACH ROW
    EXECUTE FUNCTION update_kb_search_vector();

-- RLS
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    CREATE POLICY "Users can read own knowledge base"
        ON knowledge_base FOR SELECT
        USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN
    NULL;
END;
$$;

DO $$
BEGIN
    CREATE POLICY "Service role full access to knowledge base"
        ON knowledge_base FOR ALL
        USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END;
$$;


-- =============================================================================
-- 2. SCOUT PERFORMANCE - Learning from past executions
-- =============================================================================

CREATE TABLE IF NOT EXISTS scout_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    agent_mode TEXT NOT NULL DEFAULT 'strategy',

    -- Scout identity
    scout_id TEXT NOT NULL,
    scout_name TEXT NOT NULL,
    scout_role TEXT,
    expertise TEXT[] DEFAULT '{}',

    -- Configuration
    model_tier TEXT NOT NULL,
    tools_assigned TEXT[] DEFAULT '{}',
    research_approach TEXT,
    search_queries TEXT[] DEFAULT '{}',
    browser_targets TEXT[] DEFAULT '{}',

    -- Results
    findings_count INTEGER DEFAULT 0,
    high_confidence_count INTEGER DEFAULT 0,
    medium_confidence_count INTEGER DEFAULT 0,
    low_confidence_count INTEGER DEFAULT 0,
    avg_relevance_score REAL DEFAULT 0,

    -- Execution metrics
    execution_time_ms INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost_incurred REAL DEFAULT 0,
    searches_executed INTEGER DEFAULT 0,
    pages_visited INTEGER DEFAULT 0,
    screenshots_taken INTEGER DEFAULT 0,
    tool_calls_total INTEGER DEFAULT 0,
    tool_calls_succeeded INTEGER DEFAULT 0,
    tool_calls_failed INTEGER DEFAULT 0,

    -- Outcome
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    spawned_children INTEGER DEFAULT 0,
    gaps_identified TEXT[] DEFAULT '{}',

    -- Domain context
    domain TEXT,
    problem_complexity TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sp_user_mode ON scout_performance(user_id, agent_mode);
CREATE INDEX IF NOT EXISTS idx_sp_tools ON scout_performance USING gin(tools_assigned);
CREATE INDEX IF NOT EXISTS idx_sp_domain ON scout_performance(domain);
CREATE INDEX IF NOT EXISTS idx_sp_status ON scout_performance(status);
CREATE INDEX IF NOT EXISTS idx_sp_created ON scout_performance(created_at DESC);

ALTER TABLE scout_performance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    CREATE POLICY "Users can read own scout performance"
        ON scout_performance FOR SELECT
        USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN
    NULL;
END;
$$;

DO $$
BEGIN
    CREATE POLICY "Service role full access to scout performance"
        ON scout_performance FOR ALL
        USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END;
$$;


-- =============================================================================
-- 3. ARTIFACTS - Generated deliverables (charts, tables, reports)
-- =============================================================================

CREATE TABLE IF NOT EXISTS strategy_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,

    -- Artifact metadata
    artifact_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    mime_type TEXT NOT NULL,
    file_name TEXT NOT NULL,

    -- Content
    content_base64 TEXT,
    content_text TEXT,

    -- Size tracking
    size_bytes INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_session ON strategy_artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_user ON strategy_artifacts(user_id);

ALTER TABLE strategy_artifacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    CREATE POLICY "Users can read own artifacts"
        ON strategy_artifacts FOR SELECT
        USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN
    NULL;
END;
$$;

DO $$
BEGIN
    CREATE POLICY "Service role full access to artifacts"
        ON strategy_artifacts FOR ALL
        USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END;
$$;

-- ============================================
-- WORKSPACE INFRASTRUCTURE DATABASE SCHEMA
-- ============================================
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- WORKSPACES
-- ============================================

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('project', 'sandbox', 'github')),
  github_repo TEXT,
  github_branch TEXT DEFAULT 'main',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  config JSONB NOT NULL DEFAULT '{}',
  container_id TEXT, -- E2B sandbox ID or Docker container ID
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX idx_workspaces_status ON workspaces(status);

-- RLS Policies
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspaces"
  ON workspaces FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspaces"
  ON workspaces FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspaces"
  ON workspaces FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SHELL SESSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS shell_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('running', 'idle', 'terminated')),
  cwd TEXT NOT NULL DEFAULT '/',
  env_vars JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shell_sessions_workspace_id ON shell_sessions(workspace_id);

-- RLS
ALTER TABLE shell_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage shell sessions in own workspaces"
  ON shell_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = shell_sessions.workspace_id
      AND w.user_id = auth.uid()
    )
  );

-- ============================================
-- SHELL COMMAND HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS shell_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES shell_sessions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  output TEXT,
  exit_code INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

CREATE INDEX idx_shell_commands_session_id ON shell_commands(session_id);
CREATE INDEX idx_shell_commands_workspace_id ON shell_commands(workspace_id);
CREATE INDEX idx_shell_commands_started_at ON shell_commands(started_at DESC);

-- RLS
ALTER TABLE shell_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view commands in own workspaces"
  ON shell_commands FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = shell_commands.workspace_id
      AND w.user_id = auth.uid()
    )
  );

-- ============================================
-- BACKGROUND TASKS
-- ============================================

CREATE TABLE IF NOT EXISTS background_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('shell', 'build', 'test', 'deploy', 'index', 'custom')),
  command TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  output JSONB DEFAULT '[]', -- Array of output chunks
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_background_tasks_workspace_id ON background_tasks(workspace_id);
CREATE INDEX idx_background_tasks_user_id ON background_tasks(user_id);
CREATE INDEX idx_background_tasks_status ON background_tasks(status);
CREATE INDEX idx_background_tasks_created_at ON background_tasks(created_at DESC);

-- RLS
ALTER TABLE background_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own background tasks"
  ON background_tasks FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- AI SESSIONS (Context Management)
-- ============================================

CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  token_count INTEGER DEFAULT 0,
  max_tokens INTEGER DEFAULT 100000,
  active_files TEXT[] DEFAULT '{}',
  active_tools TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_sessions_workspace_id ON ai_sessions(workspace_id);
CREATE INDEX idx_ai_sessions_user_id ON ai_sessions(user_id);
CREATE INDEX idx_ai_sessions_updated_at ON ai_sessions(updated_at DESC);

-- RLS
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own AI sessions"
  ON ai_sessions FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- BATCH OPERATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS batch_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operations JSONB NOT NULL, -- Array of file operations
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'committed', 'rolled_back')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

CREATE INDEX idx_batch_operations_workspace_id ON batch_operations(workspace_id);
CREATE INDEX idx_batch_operations_status ON batch_operations(status);

-- RLS
ALTER TABLE batch_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own batch operations"
  ON batch_operations FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- CODEBASE INDEX
-- ============================================

CREATE TABLE IF NOT EXISTS codebase_indexes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  files JSONB NOT NULL DEFAULT '[]', -- Array of IndexedFile
  symbols JSONB NOT NULL DEFAULT '[]', -- Array of Symbol
  dependencies JSONB NOT NULL DEFAULT '[]', -- Array of Dependency
  stats JSONB DEFAULT '{}', -- Lines of code, file count, etc.
  last_indexed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_codebase_indexes_workspace_id ON codebase_indexes(workspace_id);

-- RLS
ALTER TABLE codebase_indexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view indexes for own workspaces"
  ON codebase_indexes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = codebase_indexes.workspace_id
      AND w.user_id = auth.uid()
    )
  );

-- ============================================
-- FILE EMBEDDINGS (Semantic Search)
-- ============================================

CREATE TABLE IF NOT EXISTS file_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, file_path, chunk_index)
);

CREATE INDEX idx_file_embeddings_workspace_id ON file_embeddings(workspace_id);
CREATE INDEX idx_file_embeddings_file_path ON file_embeddings(file_path);

-- Vector similarity search index
CREATE INDEX idx_file_embeddings_embedding ON file_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS
ALTER TABLE file_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage embeddings for own workspaces"
  ON file_embeddings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = file_embeddings.workspace_id
      AND w.user_id = auth.uid()
    )
  );

-- ============================================
-- TOOL EXECUTIONS (Audit Log)
-- ============================================

CREATE TABLE IF NOT EXISTS tool_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  session_id UUID REFERENCES ai_sessions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  success BOOLEAN,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tool_executions_user_id ON tool_executions(user_id);
CREATE INDEX idx_tool_executions_workspace_id ON tool_executions(workspace_id);
CREATE INDEX idx_tool_executions_tool_name ON tool_executions(tool_name);
CREATE INDEX idx_tool_executions_created_at ON tool_executions(created_at DESC);

-- RLS
ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tool executions"
  ON tool_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create tool executions"
  ON tool_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- WORKSPACE SNAPSHOTS (For rollback)
-- ============================================

CREATE TABLE IF NOT EXISTS workspace_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  file_tree JSONB NOT NULL, -- Snapshot of file structure
  git_commit TEXT, -- Git commit hash at snapshot time
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workspace_snapshots_workspace_id ON workspace_snapshots(workspace_id);
CREATE INDEX idx_workspace_snapshots_created_at ON workspace_snapshots(created_at DESC);

-- RLS
ALTER TABLE workspace_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage snapshots for own workspaces"
  ON workspace_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = workspace_snapshots.workspace_id
      AND w.user_id = auth.uid()
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to search code by embedding similarity
CREATE OR REPLACE FUNCTION search_code_embeddings(
  p_workspace_id UUID,
  p_query_embedding vector(1536),
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  file_path TEXT,
  chunk_index INTEGER,
  content TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fe.file_path,
    fe.chunk_index,
    fe.content,
    1 - (fe.embedding <=> p_query_embedding) AS similarity
  FROM file_embeddings fe
  WHERE fe.workspace_id = p_workspace_id
  ORDER BY fe.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get workspace stats
CREATE OR REPLACE FUNCTION get_workspace_stats(p_workspace_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_commands', (SELECT COUNT(*) FROM shell_commands WHERE workspace_id = p_workspace_id),
    'total_tasks', (SELECT COUNT(*) FROM background_tasks WHERE workspace_id = p_workspace_id),
    'active_sessions', (SELECT COUNT(*) FROM shell_sessions WHERE workspace_id = p_workspace_id AND status = 'running'),
    'total_files', (SELECT jsonb_array_length(files) FROM codebase_indexes WHERE workspace_id = p_workspace_id),
    'total_symbols', (SELECT jsonb_array_length(symbols) FROM codebase_indexes WHERE workspace_id = p_workspace_id),
    'last_activity', (SELECT MAX(last_activity_at) FROM shell_sessions WHERE workspace_id = p_workspace_id)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_workspace_data()
RETURNS void AS $$
BEGIN
  -- Delete commands older than 30 days
  DELETE FROM shell_commands
  WHERE started_at < NOW() - INTERVAL '30 days';

  -- Delete completed background tasks older than 7 days
  DELETE FROM background_tasks
  WHERE status IN ('completed', 'failed', 'cancelled')
  AND completed_at < NOW() - INTERVAL '7 days';

  -- Delete old snapshots (keep last 10 per workspace)
  DELETE FROM workspace_snapshots
  WHERE id NOT IN (
    SELECT id FROM workspace_snapshots ws2
    WHERE ws2.workspace_id = workspace_snapshots.workspace_id
    ORDER BY created_at DESC
    LIMIT 10
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ai_sessions_updated_at
  BEFORE UPDATE ON ai_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE workspaces IS 'User development workspaces with isolated environments';
COMMENT ON TABLE shell_sessions IS 'Active shell sessions within workspaces';
COMMENT ON TABLE shell_commands IS 'History of executed shell commands';
COMMENT ON TABLE background_tasks IS 'Long-running background tasks (builds, tests, deploys)';
COMMENT ON TABLE ai_sessions IS 'AI conversation sessions with context management';
COMMENT ON TABLE batch_operations IS 'Atomic file operations with rollback support';
COMMENT ON TABLE codebase_indexes IS 'Indexed codebase for semantic search';
COMMENT ON TABLE file_embeddings IS 'Vector embeddings for semantic code search';
COMMENT ON TABLE tool_executions IS 'Audit log of all tool executions';
COMMENT ON TABLE workspace_snapshots IS 'Point-in-time workspace snapshots for rollback';

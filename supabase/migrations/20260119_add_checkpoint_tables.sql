-- ============================================================================
-- WORKSPACE CHECKPOINTS
-- Full workspace state snapshots for rewind/restore functionality
-- ============================================================================

CREATE TABLE IF NOT EXISTS workspace_checkpoints (
  id TEXT PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES code_lab_sessions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('manual', 'auto_milestone', 'auto_error', 'pre_deploy', 'fork_point')),
  message_count INTEGER NOT NULL DEFAULT 0,
  files JSONB NOT NULL DEFAULT '[]',
  context JSONB NOT NULL DEFAULT '{}',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_checkpoint_session ON workspace_checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_user ON workspace_checkpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_type ON workspace_checkpoints(type);
CREATE INDEX IF NOT EXISTS idx_checkpoint_created ON workspace_checkpoints(created_at DESC);

-- RLS
ALTER TABLE workspace_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own checkpoints"
  ON workspace_checkpoints
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- FILE BACKUPS (for large file storage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_backups (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  edit_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_workspace ON file_backups(workspace_id);
CREATE INDEX IF NOT EXISTS idx_backup_file ON file_backups(file_path);
CREATE INDEX IF NOT EXISTS idx_backup_created ON file_backups(created_at DESC);

ALTER TABLE file_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own backups"
  ON file_backups
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- CUSTOM SLASH COMMANDS
-- User-defined commands from .claude/commands/ directory
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_slash_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL,
  parameters JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_custom_cmd_user ON custom_slash_commands(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_cmd_workspace ON custom_slash_commands(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_cmd_name ON custom_slash_commands(name);

ALTER TABLE custom_slash_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own commands"
  ON custom_slash_commands
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- MCP SERVER PERMISSIONS (scope-based)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_server_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'workspace', 'session')),
  scope_id TEXT, -- workspace_id or session_id for non-global scopes
  allowed_tools TEXT[] DEFAULT '{}',
  denied_tools TEXT[] DEFAULT '{}',
  auto_approve BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, server_id, scope, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_mcp_perm_user ON mcp_server_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_perm_server ON mcp_server_permissions(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_perm_scope ON mcp_server_permissions(scope);

ALTER TABLE mcp_server_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own MCP permissions"
  ON mcp_server_permissions
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- SESSION HOOKS EXECUTION LOG
-- Track hook executions for debugging
-- ============================================================================

CREATE TABLE IF NOT EXISTS hook_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES code_lab_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hook_id TEXT NOT NULL,
  hook_event TEXT NOT NULL,
  tool_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'blocked', 'skipped')),
  output TEXT,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hook_exec_session ON hook_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_hook_exec_user ON hook_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_hook_exec_event ON hook_executions(hook_event);
CREATE INDEX IF NOT EXISTS idx_hook_exec_created ON hook_executions(created_at DESC);

ALTER TABLE hook_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own hook executions"
  ON hook_executions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert hook executions"
  ON hook_executions
  FOR INSERT
  WITH CHECK (true);

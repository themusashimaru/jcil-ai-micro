-- User MCP Server Configurations
-- Persists which MCP servers each user has enabled and their custom configs.
-- Works alongside the existing mcp_server_permissions table.

CREATE TABLE IF NOT EXISTS user_mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  command TEXT NOT NULL,
  args TEXT[] DEFAULT '{}',
  env JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT false,
  timeout_ms INTEGER DEFAULT 30000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, server_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_mcp_servers_user ON user_mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mcp_servers_enabled ON user_mcp_servers(user_id, enabled);

-- RLS
ALTER TABLE user_mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own MCP servers"
  ON user_mcp_servers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_user_mcp_servers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_mcp_servers_updated
  BEFORE UPDATE ON user_mcp_servers
  FOR EACH ROW
  EXECUTE FUNCTION update_user_mcp_servers_timestamp();

-- Add Notion connector columns to users table
-- Token is stored encrypted with AES-256-GCM
-- OAuth-based integration for workspace management

ALTER TABLE users
ADD COLUMN IF NOT EXISTS notion_access_token TEXT,
ADD COLUMN IF NOT EXISTS notion_workspace_id TEXT,
ADD COLUMN IF NOT EXISTS notion_workspace_name TEXT,
ADD COLUMN IF NOT EXISTS notion_bot_id TEXT,
ADD COLUMN IF NOT EXISTS notion_user_name TEXT,
ADD COLUMN IF NOT EXISTS notion_user_email TEXT,
ADD COLUMN IF NOT EXISTS notion_connected_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN users.notion_access_token IS 'Encrypted Notion OAuth access token (AES-256-GCM)';
COMMENT ON COLUMN users.notion_workspace_id IS 'Notion workspace ID';
COMMENT ON COLUMN users.notion_workspace_name IS 'Notion workspace name';
COMMENT ON COLUMN users.notion_bot_id IS 'Notion integration bot ID';
COMMENT ON COLUMN users.notion_user_name IS 'Notion user display name';
COMMENT ON COLUMN users.notion_user_email IS 'Notion user email';
COMMENT ON COLUMN users.notion_connected_at IS 'When Notion was connected';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_notion_workspace_id ON users(notion_workspace_id);

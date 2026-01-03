-- Add Vercel token columns to users table
-- Tokens are stored encrypted with AES-256-GCM

ALTER TABLE users
ADD COLUMN IF NOT EXISTS vercel_token TEXT,
ADD COLUMN IF NOT EXISTS vercel_username TEXT,
ADD COLUMN IF NOT EXISTS vercel_team_id TEXT;

-- Add comments explaining fields
COMMENT ON COLUMN users.vercel_token IS 'Encrypted Vercel API Token (AES-256-GCM)';
COMMENT ON COLUMN users.vercel_username IS 'Vercel username associated with the token';
COMMENT ON COLUMN users.vercel_team_id IS 'Optional Vercel team ID for team deployments';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_vercel_username ON users(vercel_username);

-- Update the secure view to include vercel_username
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
  id,
  email,
  full_name,
  role,
  field,
  purpose,
  subscription_tier,
  github_username,   -- GitHub username is ok to show
  vercel_username,   -- Vercel username is ok to show
  -- tokens are NEVER exposed in this view
  created_at,
  updated_at
FROM users;

-- Note: The vercel_token column is only accessed via service_role
-- in the API routes, never exposed to the client directly.

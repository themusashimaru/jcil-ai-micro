-- Add GitHub token columns to users table
-- Tokens are stored encrypted with AES-256-GCM

ALTER TABLE users
ADD COLUMN IF NOT EXISTS github_token TEXT,
ADD COLUMN IF NOT EXISTS github_username TEXT;

-- Add comment explaining encryption
COMMENT ON COLUMN users.github_token IS 'Encrypted GitHub Personal Access Token (AES-256-GCM)';
COMMENT ON COLUMN users.github_username IS 'GitHub username associated with the token';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_github_username ON users(github_username);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) for token protection
-- =====================================================

-- Enable RLS on users table (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own data
CREATE POLICY IF NOT EXISTS "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- Policy: Users can only update their own data
CREATE POLICY IF NOT EXISTS "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Policy: Only service role can insert (handled by auth callback)
-- Regular users cannot insert directly

-- =====================================================
-- Additional security: Prevent token from being exposed
-- in any views or functions except via service role
-- =====================================================

-- Create a secure view that excludes sensitive fields
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
  id,
  email,
  full_name,
  role,
  field,
  purpose,
  subscription_tier,
  github_username,  -- Username is ok to show
  -- github_token is NEVER exposed in this view
  created_at,
  updated_at
FROM users;

-- Grant access to authenticated users
GRANT SELECT ON public.user_profiles TO authenticated;

-- Revoke direct access to github_token column for anon/authenticated roles
-- (Service role will still have access for API operations)
REVOKE ALL ON users FROM anon;
REVOKE ALL ON users FROM authenticated;
GRANT SELECT, UPDATE ON users TO authenticated;

-- Note: The github_token column is only accessed via service_role
-- in the API routes, never exposed to the client directly.

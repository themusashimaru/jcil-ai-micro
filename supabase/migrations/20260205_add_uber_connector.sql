-- Add Uber connector columns to users table
-- Tokens are stored encrypted with AES-256-GCM
-- OAuth-based integration for ride estimates and requests

ALTER TABLE users
ADD COLUMN IF NOT EXISTS uber_access_token TEXT,
ADD COLUMN IF NOT EXISTS uber_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS uber_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS uber_user_id TEXT,
ADD COLUMN IF NOT EXISTS uber_first_name TEXT,
ADD COLUMN IF NOT EXISTS uber_last_name TEXT,
ADD COLUMN IF NOT EXISTS uber_email TEXT,
ADD COLUMN IF NOT EXISTS uber_connected_at TIMESTAMPTZ;

-- Add comments explaining columns
COMMENT ON COLUMN users.uber_access_token IS 'Encrypted Uber OAuth access token (AES-256-GCM)';
COMMENT ON COLUMN users.uber_refresh_token IS 'Encrypted Uber OAuth refresh token (AES-256-GCM)';
COMMENT ON COLUMN users.uber_token_expires_at IS 'Access token expiration timestamp';
COMMENT ON COLUMN users.uber_user_id IS 'Uber user UUID';
COMMENT ON COLUMN users.uber_first_name IS 'Uber account first name';
COMMENT ON COLUMN users.uber_last_name IS 'Uber account last name';
COMMENT ON COLUMN users.uber_email IS 'Uber account email';
COMMENT ON COLUMN users.uber_connected_at IS 'When Uber was connected';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_uber_user_id ON users(uber_user_id);

-- Update the user_profiles view to include Uber display info (but NOT tokens)
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
  id,
  email,
  full_name,
  role,
  field,
  purpose,
  subscription_tier,
  github_username,
  spotify_display_name,
  spotify_image_url,
  spotify_product,
  spotify_connected_at,
  uber_first_name,
  uber_last_name,
  uber_connected_at,
  -- NEVER expose tokens in this view
  created_at,
  updated_at
FROM users;

-- Note: Uber tokens are only accessed via service_role
-- in the API routes, never exposed to the client directly.

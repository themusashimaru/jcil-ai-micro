-- Add Spotify connector columns to users table
-- Tokens are stored encrypted with AES-256-GCM
-- OAuth-based integration for music control and playlists

ALTER TABLE users
ADD COLUMN IF NOT EXISTS spotify_access_token TEXT,
ADD COLUMN IF NOT EXISTS spotify_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS spotify_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS spotify_user_id TEXT,
ADD COLUMN IF NOT EXISTS spotify_display_name TEXT,
ADD COLUMN IF NOT EXISTS spotify_email TEXT,
ADD COLUMN IF NOT EXISTS spotify_image_url TEXT,
ADD COLUMN IF NOT EXISTS spotify_product TEXT,
ADD COLUMN IF NOT EXISTS spotify_connected_at TIMESTAMPTZ;

-- Add comments explaining columns
COMMENT ON COLUMN users.spotify_access_token IS 'Encrypted Spotify OAuth access token (AES-256-GCM)';
COMMENT ON COLUMN users.spotify_refresh_token IS 'Encrypted Spotify OAuth refresh token (AES-256-GCM)';
COMMENT ON COLUMN users.spotify_token_expires_at IS 'Access token expiration timestamp';
COMMENT ON COLUMN users.spotify_user_id IS 'Spotify user ID';
COMMENT ON COLUMN users.spotify_display_name IS 'Spotify display name';
COMMENT ON COLUMN users.spotify_email IS 'Spotify account email';
COMMENT ON COLUMN users.spotify_image_url IS 'Spotify profile image URL';
COMMENT ON COLUMN users.spotify_product IS 'Spotify subscription type (premium/free/open)';
COMMENT ON COLUMN users.spotify_connected_at IS 'When Spotify was connected';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_spotify_user_id ON users(spotify_user_id);

-- Update the user_profiles view to include Spotify display info (but NOT tokens)
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
  -- NEVER expose tokens in this view
  created_at,
  updated_at
FROM users;

-- Note: Spotify tokens are only accessed via service_role
-- in the API routes, never exposed to the client directly.

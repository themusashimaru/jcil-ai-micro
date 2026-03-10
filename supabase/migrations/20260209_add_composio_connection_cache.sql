-- ============================================================================
-- COMPOSIO CONNECTION CACHE
-- ============================================================================
-- Local cache for Composio connection status to prevent connections from
-- appearing "dropped" when the Composio API is slow or returns stale data.
--
-- The cache stores connection IDs and status locally, synced from Composio.
-- This allows the app to show connection status even if Composio API fails.
-- ============================================================================

-- Create composio_connection_cache table
CREATE TABLE IF NOT EXISTS composio_connection_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id TEXT NOT NULL,  -- Composio's connection ID
    toolkit TEXT NOT NULL,        -- Toolkit ID (e.g., TWITTER, GMAIL, SLACK)
    status TEXT NOT NULL DEFAULT 'connected',  -- connected, pending, expired, failed, disconnected
    connected_at TIMESTAMPTZ,     -- When the connection was established
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),  -- Last time we verified with Composio API
    metadata JSONB DEFAULT '{}',  -- Extra info (email, username, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one connection per user per toolkit
    -- (allows reconnecting to the same toolkit)
    UNIQUE(user_id, toolkit)
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_composio_connection_cache_user_id
ON composio_connection_cache(user_id);

-- Create index for toolkit lookups
CREATE INDEX IF NOT EXISTS idx_composio_connection_cache_toolkit
ON composio_connection_cache(toolkit);

-- Create index for status lookups
CREATE INDEX IF NOT EXISTS idx_composio_connection_cache_status
ON composio_connection_cache(status);

-- Create index for last_verified_at (for cache expiration queries)
CREATE INDEX IF NOT EXISTS idx_composio_connection_cache_last_verified
ON composio_connection_cache(last_verified_at);

-- Add trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_composio_connection_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_composio_connection_cache_updated_at ON composio_connection_cache;
CREATE TRIGGER trigger_update_composio_connection_cache_updated_at
    BEFORE UPDATE ON composio_connection_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_composio_connection_cache_updated_at();

-- Enable RLS
ALTER TABLE composio_connection_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own cached connections
CREATE POLICY "Users can view their own cached connections"
    ON composio_connection_cache
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cached connections"
    ON composio_connection_cache
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cached connections"
    ON composio_connection_cache
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cached connections"
    ON composio_connection_cache
    FOR DELETE
    USING (auth.uid() = user_id);

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON composio_connection_cache TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE composio_connection_cache IS
'Local cache for Composio connection status. Synced from Composio API to prevent connection "drops" during API issues.';

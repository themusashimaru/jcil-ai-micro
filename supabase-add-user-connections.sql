-- USER CONNECTIONS TABLE
-- Stores encrypted API tokens for external service integrations
-- Run this in Supabase SQL Editor

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the user_connections table
CREATE TABLE IF NOT EXISTS public.user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL, -- e.g., 'github', 'shopify', 'notion'
  encrypted_token TEXT NOT NULL, -- AES encrypted token
  display_name TEXT, -- Optional: user's label for this connection
  metadata JSONB DEFAULT '{}', -- Optional: service-specific data (e.g., selected repo)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only have one connection per service
  UNIQUE(user_id, service)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_connections_user_id ON public.user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_service ON public.user_connections(service);

-- RLS policies
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own connections
CREATE POLICY "Users can view own connections" ON public.user_connections
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own connections
CREATE POLICY "Users can insert own connections" ON public.user_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own connections
CREATE POLICY "Users can update own connections" ON public.user_connections
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own connections
CREATE POLICY "Users can delete own connections" ON public.user_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_user_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_connections_timestamp
  BEFORE UPDATE ON public.user_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_user_connections_updated_at();

-- Grant permissions
GRANT ALL ON public.user_connections TO authenticated;
GRANT ALL ON public.user_connections TO service_role;

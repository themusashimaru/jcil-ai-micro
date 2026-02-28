-- Passkeys/WebAuthn Credentials Table
-- Run this in your Supabase SQL Editor

-- Create the user_passkeys table
CREATE TABLE IF NOT EXISTS public.user_passkeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- WebAuthn credential data
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,

    -- Device info for user reference
    device_name TEXT NOT NULL DEFAULT 'Unknown Device',

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Transports (how the authenticator communicates)
    transports TEXT[] DEFAULT '{}'
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_id ON public.user_passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_credential_id ON public.user_passkeys(credential_id);

-- Enable RLS
ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/manage their own passkeys
CREATE POLICY "Users can view own passkeys"
    ON public.user_passkeys FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own passkeys"
    ON public.user_passkeys FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own passkeys"
    ON public.user_passkeys FOR DELETE
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own passkeys"
    ON public.user_passkeys FOR UPDATE
    USING (user_id = auth.uid());

-- Service role bypass for server-side operations
CREATE POLICY "Service role full access"
    ON public.user_passkeys FOR ALL
    USING (auth.role() = 'service_role');

-- Add a column to users table to track if user has been prompted for passkeys
-- This prevents nagging users who dismissed the prompt
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS passkey_prompt_dismissed BOOLEAN DEFAULT FALSE;

-- Comment for documentation
COMMENT ON TABLE public.user_passkeys IS 'Stores WebAuthn/Passkey credentials for biometric authentication (Face ID, Touch ID, Windows Hello)';
COMMENT ON COLUMN public.user_passkeys.credential_id IS 'Base64URL encoded credential ID from WebAuthn';
COMMENT ON COLUMN public.user_passkeys.public_key IS 'Base64URL encoded public key for signature verification';
COMMENT ON COLUMN public.user_passkeys.counter IS 'Signature counter for replay attack prevention';
COMMENT ON COLUMN public.user_passkeys.transports IS 'Array of transport hints (usb, nfc, ble, internal)';

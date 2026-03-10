-- ============================================================================
-- FIX GENERATIONS BUCKET - PUBLIC READ ACCESS
-- ============================================================================
--
-- This migration fixes the generations bucket to allow public read access
-- while keeping uploads restricted to authenticated users.
--
-- Security Model:
-- - Images are stored with UUID-based paths (unguessable)
-- - Anyone with the URL can view the image (good for sharing)
-- - Database RLS on 'generations' table ensures users only see their own records
-- - Uploads are restricted to authenticated users via service role
-- ============================================================================

-- Update bucket to be public (allows public reads)
UPDATE storage.buckets
SET public = true
WHERE id = 'generations';

-- If bucket doesn't exist, create it
INSERT INTO storage.buckets (id, name, public)
VALUES ('generations', 'generations', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can read own generations" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access on generations" ON storage.objects;
DROP POLICY IF EXISTS "Public read access on generations" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload to own folder" ON storage.objects;

-- Policy 1: Anyone can read from generations bucket (public URLs work)
CREATE POLICY "Public read access on generations"
ON storage.objects FOR SELECT
USING (bucket_id = 'generations');

-- Policy 2: Authenticated users can upload to their own folder
CREATE POLICY "Authenticated users upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'generations'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Users can delete their own files
CREATE POLICY "Users can delete own generations"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'generations'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- DATABASE RLS ON GENERATIONS TABLE
-- ============================================================================
-- Ensure users can only see their own generation records

-- Enable RLS on generations table
ALTER TABLE IF EXISTS public.generations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own generations" ON public.generations;
DROP POLICY IF EXISTS "Users can insert own generations" ON public.generations;
DROP POLICY IF EXISTS "Users can update own generations" ON public.generations;
DROP POLICY IF EXISTS "Users can delete own generations" ON public.generations;
DROP POLICY IF EXISTS "Service role bypass" ON public.generations;

-- Users can only read their own generations
CREATE POLICY "Users can read own generations"
ON public.generations FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own generations
CREATE POLICY "Users can insert own generations"
ON public.generations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own generations
CREATE POLICY "Users can update own generations"
ON public.generations FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own generations
CREATE POLICY "Users can delete own generations"
ON public.generations FOR DELETE
USING (auth.uid() = user_id);

-- Service role can do everything (for API routes)
CREATE POLICY "Service role bypass"
ON public.generations FOR ALL
USING (auth.role() = 'service_role');

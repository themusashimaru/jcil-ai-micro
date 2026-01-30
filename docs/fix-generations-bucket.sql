-- ============================================================================
-- QUICK FIX: GENERATIONS BUCKET PUBLIC ACCESS
-- ============================================================================
-- Run this in your Supabase SQL Editor to fix image loading issues.
--
-- This makes images publicly readable (via unguessable UUID URLs) while
-- keeping the database records private to each user.
-- ============================================================================

-- Step 1: Make the bucket public for reads
UPDATE storage.buckets
SET public = true
WHERE id = 'generations';

-- Step 2: Add public read policy for storage
DROP POLICY IF EXISTS "Public read access on generations" ON storage.objects;
CREATE POLICY "Public read access on generations"
ON storage.objects FOR SELECT
USING (bucket_id = 'generations');

-- Done! Images should now load.

-- ============================================================================
-- VERIFICATION: Run this query to confirm the bucket is public
-- ============================================================================
-- SELECT id, name, public FROM storage.buckets WHERE id = 'generations';
-- Expected: public = true

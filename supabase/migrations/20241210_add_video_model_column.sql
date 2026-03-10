-- Add video_model column to provider_settings table
-- This allows admin to configure which video generation model to use

-- Add video_model column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'provider_settings'
        AND column_name = 'video_model'
    ) THEN
        ALTER TABLE provider_settings
        ADD COLUMN video_model TEXT DEFAULT 'sora-2-pro';
    END IF;
END $$;

-- Update any null values to the default
UPDATE provider_settings
SET video_model = COALESCE(video_model, 'sora-2-pro')
WHERE video_model IS NULL;

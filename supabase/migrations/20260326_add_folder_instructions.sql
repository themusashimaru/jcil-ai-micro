-- Add custom instructions to chat folders for project-level context
ALTER TABLE public.chat_folders ADD COLUMN IF NOT EXISTS custom_instructions TEXT;

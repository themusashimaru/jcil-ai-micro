-- Migration: Add mode column to strategy_sessions
-- The mode column was added to the application code (commit fca2a7c) but never
-- added to the database schema. This causes session creation to fail when
-- PostgREST rejects the unknown column, breaking ALL agent types.

ALTER TABLE strategy_sessions ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'strategy';

COMMENT ON COLUMN strategy_sessions.mode IS 'Agent mode: strategy, research, quick-research, quick-strategy, quick-writer, deep-writer';

-- Add timeline column to daily_challenge_results for efficient resume support.
-- Stores the growing ordered list of revealed + placed cards (same structure
-- as solo_sessions.timeline). Initialised with the anchor card on row creation;
-- updated by daily-turn on each correct placement.
ALTER TABLE daily_challenge_results
  ADD COLUMN timeline JSONB NOT NULL DEFAULT '[]';

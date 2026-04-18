-- Migration: add difficulty and variant columns to leaderboard_entries
-- Epic 29 — Difficulty & Variant Overhaul — Story 29.6
--
-- Allows the leaderboard to be filtered by difficulty tier and game variant.
-- Columns are nullable so existing rows remain valid.

ALTER TABLE leaderboard_entries
  ADD COLUMN difficulty TEXT,
  ADD COLUMN variant    TEXT;

CREATE INDEX idx_leaderboard_difficulty ON leaderboard_entries (difficulty);
CREATE INDEX idx_leaderboard_variant    ON leaderboard_entries (variant);

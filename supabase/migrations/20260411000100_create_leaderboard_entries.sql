-- Migration: create leaderboard_entries table
-- Epic 8 — Authentication & Leaderboard

CREATE TABLE leaderboard_entries (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    score      INTEGER NOT NULL CHECK (score >= 0),
    streak     INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- Anyone can read the leaderboard (public)
CREATE POLICY "Leaderboard is publicly readable"
    ON leaderboard_entries FOR SELECT
    USING (true);

-- Authenticated users can insert their own scores
CREATE POLICY "Users can submit own scores"
    ON leaderboard_entries FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid()));

-- No UPDATE or DELETE policies — scores are immutable

CREATE INDEX idx_leaderboard_score ON leaderboard_entries (score DESC, created_at ASC);
CREATE INDEX idx_leaderboard_user  ON leaderboard_entries (user_id);

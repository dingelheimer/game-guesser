-- daily_challenges: stores the pre-generated challenge for each UTC day.
-- Created once daily by the daily-generate scheduled Edge Function.
CREATE TABLE daily_challenges (
  id               SERIAL PRIMARY KEY,
  challenge_number INTEGER NOT NULL UNIQUE,
  challenge_date   DATE NOT NULL UNIQUE,
  deck             BIGINT[] NOT NULL,
  difficulty       TEXT NOT NULL DEFAULT 'medium',
  variant          TEXT NOT NULL DEFAULT 'standard',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: anyone can read; writes are service-role only (no public write policy).
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read daily_challenges"
  ON daily_challenges FOR SELECT USING (true);

-- daily_challenge_results: stores each player's attempt per challenge.
CREATE TABLE daily_challenge_results (
  id             SERIAL PRIMARY KEY,
  challenge_id   INTEGER NOT NULL REFERENCES daily_challenges(id),
  user_id        UUID REFERENCES profiles(id) ON DELETE CASCADE,
  anonymous_id   UUID,
  score          INTEGER NOT NULL DEFAULT 0,
  turns_played   INTEGER NOT NULL DEFAULT 0,
  extra_try_used BOOLEAN NOT NULL DEFAULT FALSE,
  placements     JSONB NOT NULL DEFAULT '[]',
  completed      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,

  -- Each authenticated user can only play each challenge once.
  CONSTRAINT unique_user_challenge
    UNIQUE NULLS NOT DISTINCT (challenge_id, user_id),
  -- Each guest (by anonymous_id) can only play each challenge once.
  CONSTRAINT unique_anon_challenge
    UNIQUE NULLS NOT DISTINCT (challenge_id, anonymous_id),
  -- At least one identity must be present.
  CONSTRAINT has_identity
    CHECK (user_id IS NOT NULL OR anonymous_id IS NOT NULL)
);

CREATE INDEX idx_dcr_challenge ON daily_challenge_results (challenge_id);
CREATE INDEX idx_dcr_user      ON daily_challenge_results (user_id);
CREATE INDEX idx_dcr_score     ON daily_challenge_results (score DESC, completed_at ASC);

-- RLS: anyone can read; writes are service-role only (no public write policy).
ALTER TABLE daily_challenge_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read daily_challenge_results"
  ON daily_challenge_results FOR SELECT USING (true);

-- RPC: returns eligible game IDs for daily challenge deck building.
-- Games must be at or below the rank threshold, have a cover, and have at
-- least one non-rejected screenshot. Results ordered by id for a stable,
-- deterministic input to the seeded shuffle.
CREATE OR REPLACE FUNCTION get_daily_eligible_game_ids(p_max_rank INTEGER)
RETURNS TABLE (id BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT g.id
  FROM   games g
  WHERE  g.popularity_rank_per_year <= p_max_rank
    AND  EXISTS (SELECT 1 FROM covers    c WHERE c.game_id = g.id)
    AND  EXISTS (SELECT 1 FROM screenshots s WHERE s.game_id = g.id AND s.curation != 'rejected')
  ORDER BY g.id;
$$;


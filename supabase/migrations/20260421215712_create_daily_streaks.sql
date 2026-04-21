-- daily_streaks — tracks consecutive daily challenge completions per user.
-- Writes are exclusively via service role (Edge Functions); clients can only
-- read their own row.

CREATE TABLE IF NOT EXISTS daily_streaks (
  user_id        UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INTEGER     NOT NULL DEFAULT 0,
  best_streak    INTEGER     NOT NULL DEFAULT 0,
  last_played    DATE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE daily_streaks ENABLE ROW LEVEL SECURITY;

-- Authenticated users may only read their own streak row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_streaks' AND policyname = 'daily_streaks: owner select'
  ) THEN
    CREATE POLICY "daily_streaks: owner select"
      ON daily_streaks
      FOR SELECT
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END
$$;

-- RPC: returns ranked daily leaderboard entries for a given challenge number.
-- Joins daily_challenge_results with profiles, filtered to completed authenticated results.
-- Uses RANK() window function so tied scores share the same rank.
CREATE OR REPLACE FUNCTION get_daily_leaderboard(p_challenge_number INT, p_limit INT DEFAULT 50)
RETURNS TABLE (
  rank           BIGINT,
  user_id        UUID,
  username       TEXT,
  score          INT,
  extra_try_used BOOL,
  completed_at   TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    RANK() OVER (ORDER BY dcr.score DESC, dcr.completed_at ASC) AS rank,
    dcr.user_id,
    p.username,
    dcr.score,
    dcr.extra_try_used,
    dcr.completed_at
  FROM daily_challenge_results dcr
  JOIN profiles          p  ON p.id  = dcr.user_id
  JOIN daily_challenges  dc ON dc.id = dcr.challenge_id
  WHERE dc.challenge_number = p_challenge_number
    AND dcr.completed   = true
    AND dcr.user_id IS NOT NULL
  ORDER BY rank, dcr.completed_at ASC
  LIMIT p_limit;
$$;

-- RPC: returns the rank and result for a specific authenticated user on a given challenge.
-- Returns zero rows if the user has not completed the challenge.
CREATE OR REPLACE FUNCTION get_daily_player_rank(p_challenge_number INT, p_user_id UUID)
RETURNS TABLE (
  rank           BIGINT,
  score          INT,
  extra_try_used BOOL,
  completed_at   TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH all_results AS (
    SELECT
      dcr.user_id,
      dcr.score,
      dcr.extra_try_used,
      dcr.completed_at,
      RANK() OVER (ORDER BY dcr.score DESC, dcr.completed_at ASC) AS rank
    FROM daily_challenge_results dcr
    JOIN daily_challenges dc ON dc.id = dcr.challenge_id
    WHERE dc.challenge_number = p_challenge_number
      AND dcr.completed   = true
      AND dcr.user_id IS NOT NULL
  )
  SELECT rank, score, extra_try_used, completed_at
  FROM   all_results
  WHERE  user_id = p_user_id;
$$;

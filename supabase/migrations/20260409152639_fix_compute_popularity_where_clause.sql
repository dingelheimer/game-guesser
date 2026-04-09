-- EPIC 2, Story 2.5: Fix compute_popularity_scores for PostgREST safe mode
--
-- PostgREST (used by Supabase) runs in "safe" mode which blocks UPDATE
-- statements without a WHERE clause, even inside RPC functions.
-- Adding `WHERE id IS NOT NULL` is semantically identical (id is the PK,
-- always NOT NULL) but satisfies the safe-mode guard.

CREATE OR REPLACE FUNCTION compute_popularity_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Step 1: compute composite popularity score for every game.
  UPDATE games
  SET popularity_score = (
    COALESCE(rating_count, 0)::real * 1.0
    + COALESCE(follows, 0)::real * 0.5
    + COALESCE(hypes, 0)::real * 0.2
  )
  WHERE id IS NOT NULL;

  -- Step 2: assign per-year rank (1 = most popular within the release year).
  WITH ranked AS (
    SELECT
      id,
      RANK() OVER (
        PARTITION BY release_year
        ORDER BY popularity_score DESC NULLS LAST
      ) AS rank
    FROM games
    WHERE id IS NOT NULL
  )
  UPDATE games g
  SET popularity_rank_per_year = ranked.rank
  FROM ranked
  WHERE g.id = ranked.id;
END;
$$;

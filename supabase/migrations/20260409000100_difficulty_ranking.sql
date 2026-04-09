-- EPIC 2, Story 2.4: Game Data Pipeline — Implement Difficulty Ranking
--
-- Adds:
--   1. compute_popularity_scores() — idempotent function that sets
--      popularity_score and popularity_rank_per_year on every game.
--   2. games_by_difficulty — view that exposes each game with a
--      difficulty_tier label (easy/medium/hard/extreme).

-- ---------------------------------------------------------------------------
-- compute_popularity_scores()
--
-- Popularity formula (from research/game_data_fetching_and_storage.md):
--   popularity_score = (rating_count * 1.0) + (follows * 0.5) + (hypes * 0.2)
--
-- After computing scores, ranks each game within its release year (1 = most
-- popular). Uses RANK() so ties receive the same rank (no gaps skipped for
-- difficulty-tier filtering purposes).
--
-- SECURITY DEFINER: runs as the function owner so it can UPDATE games even
-- when RLS is active (RLS allows public SELECT but not public UPDATE).
-- ---------------------------------------------------------------------------

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
  );

  -- Step 2: assign per-year rank (1 = most popular within the release year).
  WITH ranked AS (
    SELECT
      id,
      RANK() OVER (
        PARTITION BY release_year
        ORDER BY popularity_score DESC NULLS LAST
      ) AS rank
    FROM games
  )
  UPDATE games g
  SET popularity_rank_per_year = ranked.rank
  FROM ranked
  WHERE g.id = ranked.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- games_by_difficulty
--
-- Augments every game row with a difficulty_tier column derived from
-- popularity_rank_per_year:
--   easy    — rank 1–10  (top 10 per year)
--   medium  — rank 11–20 (top 20 per year)
--   hard    — rank 21–50 (top 50 per year)
--   extreme — rank 51+, or games without a rank yet
--
-- The view inherits RLS from the underlying games table, so public SELECT
-- works automatically for anon and authenticated roles.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW games_by_difficulty AS
SELECT
  *,
  CASE
    WHEN popularity_rank_per_year <= 10 THEN 'easy'
    WHEN popularity_rank_per_year <= 20 THEN 'medium'
    WHEN popularity_rank_per_year <= 50 THEN 'hard'
    ELSE 'extreme'
  END AS difficulty_tier
FROM games;

-- Grant SELECT to the same roles that can read games.
GRANT SELECT ON games_by_difficulty TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Verification queries (run manually after seeding data)
--
-- 1. Rank distribution across years:
--
-- SELECT
--   release_year,
--   COUNT(*) FILTER (WHERE difficulty_tier = 'easy')    AS easy,
--   COUNT(*) FILTER (WHERE difficulty_tier = 'medium')  AS medium,
--   COUNT(*) FILTER (WHERE difficulty_tier = 'hard')    AS hard,
--   COUNT(*) FILTER (WHERE difficulty_tier = 'extreme') AS extreme,
--   COUNT(*)                                             AS total
-- FROM games_by_difficulty
-- GROUP BY release_year
-- ORDER BY release_year;
--
-- 2. Sample deck — 20 random Easy games with screenshots:
--
-- SELECT g.id, g.name, g.release_year,
--        c.igdb_image_id  AS cover_image_id,
--        ARRAY_AGG(s.igdb_image_id) AS screenshot_image_ids
-- FROM games_by_difficulty g
-- JOIN covers c ON c.game_id = g.id
-- JOIN screenshots s ON s.game_id = g.id AND s.curation != 'rejected'
-- WHERE g.difficulty_tier = 'easy'
-- GROUP BY g.id, g.name, g.release_year, c.igdb_image_id
-- ORDER BY RANDOM()
-- LIMIT 20;
-- ---------------------------------------------------------------------------

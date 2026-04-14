-- EPIC 12, Story 12.2: House Rules Deck Filtering & Deck Size Guard
--
-- 1. Replaces build_deck(INTEGER) with build_deck(INTEGER, BIGINT, TEXT, INTEGER)
--    adding genre lock, console lock, and decade mode filter parameters.
--    Raises an exception if the filtered pool yields fewer than 30 eligible games.
-- 2. Adds estimate_deck_size() returning the count of eligible games for the
--    given difficulty + house rule combination (used by the lobby UI).

-- ---------------------------------------------------------------------------
-- Drop old build_deck signature (CREATE OR REPLACE cannot change param list).
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS build_deck(INTEGER);

-- ---------------------------------------------------------------------------
-- build_deck (updated)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION build_deck(
  p_max_rank        INTEGER DEFAULT NULL,
  p_genre_id        BIGINT  DEFAULT NULL,
  p_platform_family TEXT    DEFAULT NULL,
  p_decade_start    INTEGER DEFAULT NULL
)
RETURNS INTEGER[]
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pool_count INTEGER;
  v_deck       INTEGER[];
BEGIN
  -- Count matching games before building the deck to enforce the minimum
  -- pool size guard of 30 games.
  SELECT COUNT(DISTINCT g.id)::INTEGER INTO v_pool_count
  FROM games g
  WHERE (p_max_rank IS NULL OR g.popularity_rank_per_year <= p_max_rank)
    AND EXISTS (SELECT 1 FROM covers      WHERE game_id = g.id)
    AND EXISTS (SELECT 1 FROM screenshots WHERE game_id = g.id AND curation != 'rejected')
    AND (
      p_genre_id IS NULL OR EXISTS (
        SELECT 1 FROM game_genres gg
        WHERE gg.game_id = g.id AND gg.genre_id = p_genre_id
      )
    )
    AND (
      p_platform_family IS NULL OR EXISTS (
        SELECT 1 FROM game_platforms gp
        JOIN platforms pl ON pl.id = gp.platform_id
        WHERE gp.game_id = g.id AND pl.family = p_platform_family
      )
    )
    AND (
      p_decade_start IS NULL OR
      (g.release_year >= p_decade_start AND g.release_year < p_decade_start + 10)
    );

  IF v_pool_count < 30 THEN
    RAISE EXCEPTION
      'Not enough games (%) match the selected filters — need at least 30',
      v_pool_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT ARRAY(
    SELECT g.id::integer
    FROM games g
    WHERE (p_max_rank IS NULL OR g.popularity_rank_per_year <= p_max_rank)
      AND EXISTS (SELECT 1 FROM covers      WHERE game_id = g.id)
      AND EXISTS (SELECT 1 FROM screenshots WHERE game_id = g.id AND curation != 'rejected')
      AND (
        p_genre_id IS NULL OR EXISTS (
          SELECT 1 FROM game_genres gg
          WHERE gg.game_id = g.id AND gg.genre_id = p_genre_id
        )
      )
      AND (
        p_platform_family IS NULL OR EXISTS (
          SELECT 1 FROM game_platforms gp
          JOIN platforms pl ON pl.id = gp.platform_id
          WHERE gp.game_id = g.id AND pl.family = p_platform_family
        )
      )
      AND (
        p_decade_start IS NULL OR
        (g.release_year >= p_decade_start AND g.release_year < p_decade_start + 10)
      )
    ORDER BY RANDOM()
    LIMIT 200
  ) INTO v_deck;

  RETURN v_deck;
END;
$$;

REVOKE ALL    ON FUNCTION build_deck(INTEGER, BIGINT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION build_deck(INTEGER, BIGINT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION build_deck(INTEGER, BIGINT, TEXT, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- estimate_deck_size
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION estimate_deck_size(
  p_max_rank        INTEGER DEFAULT NULL,
  p_genre_id        BIGINT  DEFAULT NULL,
  p_platform_family TEXT    DEFAULT NULL,
  p_decade_start    INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT g.id)::INTEGER
  FROM games g
  WHERE (p_max_rank IS NULL OR g.popularity_rank_per_year <= p_max_rank)
    AND EXISTS (SELECT 1 FROM covers      WHERE game_id = g.id)
    AND EXISTS (SELECT 1 FROM screenshots WHERE game_id = g.id AND curation != 'rejected')
    AND (
      p_genre_id IS NULL OR EXISTS (
        SELECT 1 FROM game_genres gg
        WHERE gg.game_id = g.id AND gg.genre_id = p_genre_id
      )
    )
    AND (
      p_platform_family IS NULL OR EXISTS (
        SELECT 1 FROM game_platforms gp
        JOIN platforms pl ON pl.id = gp.platform_id
        WHERE gp.game_id = g.id AND pl.family = p_platform_family
      )
    )
    AND (
      p_decade_start IS NULL OR
      (g.release_year >= p_decade_start AND g.release_year < p_decade_start + 10)
    )
$$;

REVOKE ALL    ON FUNCTION estimate_deck_size(INTEGER, BIGINT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION estimate_deck_size(INTEGER, BIGINT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION estimate_deck_size(INTEGER, BIGINT, TEXT, INTEGER) TO service_role;

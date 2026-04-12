-- EPIC 10, Story 10.2: Multiplayer Game Flow — Build Deck RPC
--
-- Returns up to 200 shuffled game IDs that qualify for a given difficulty tier.
-- Games must have a cover and at least one non-rejected screenshot.
-- p_max_rank = NULL means no rank limit (extreme difficulty).

CREATE OR REPLACE FUNCTION build_deck(p_max_rank INTEGER DEFAULT NULL)
RETURNS INTEGER[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT g.id::integer
    FROM games g
    WHERE (p_max_rank IS NULL OR g.popularity_rank_per_year <= p_max_rank)
      AND EXISTS (SELECT 1 FROM covers WHERE game_id = g.id)
      AND EXISTS (
        SELECT 1 FROM screenshots
        WHERE game_id = g.id AND curation != 'rejected'
      )
    ORDER BY RANDOM()
    LIMIT 200
  );
$$;

REVOKE ALL    ON FUNCTION build_deck(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION build_deck(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION build_deck(INTEGER) TO service_role;

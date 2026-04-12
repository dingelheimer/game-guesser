-- EPIC 21, Story 21.2: Fix RLS infinite recursion on game_players
--
-- The original "Members can read game session" policy used an EXISTS subquery
-- on game_players, and "Members can read game players" self-referenced
-- game_players. PostgreSQL detects this cross-table → self-reference chain as
-- infinite recursion (42P17). Fix mirrors the is_room_member() pattern already
-- used by the lobby tables.

CREATE OR REPLACE FUNCTION is_game_session_member(check_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM game_players
    WHERE game_session_id = check_session_id
      AND user_id = (SELECT auth.uid())
  );
$$;

DROP POLICY IF EXISTS "Members can read game session" ON game_sessions;
DROP POLICY IF EXISTS "Members can read game players" ON game_players;

CREATE POLICY "Members can read game session"
  ON game_sessions FOR SELECT TO authenticated
  USING ((SELECT is_game_session_member(id)));

CREATE POLICY "Members can read game players"
  ON game_players FOR SELECT TO authenticated
  USING ((SELECT is_game_session_member(game_session_id)));

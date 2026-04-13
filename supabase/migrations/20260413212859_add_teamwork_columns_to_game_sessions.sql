-- EPIC 12, Story 12.1: Settings Schema & Platform Families
--
-- Adds TEAMWORK shared-state columns to game_sessions and refreshes the
-- game_sessions_safe view to expose the new columns to clients.

ALTER TABLE game_sessions
  ADD COLUMN team_timeline JSONB,
  ADD COLUMN team_tokens   SMALLINT,
  ADD COLUMN team_score    SMALLINT;

-- Recreate the safe view to expose the new TEAMWORK columns.
-- The deck column remains excluded to prevent clients from seeing future cards.
DROP VIEW IF EXISTS game_sessions_safe;

CREATE VIEW game_sessions_safe WITH (security_invoker = true) AS
  SELECT
    id,
    room_id,
    status,
    current_turn,
    turn_number,
    turn_order,
    active_player_id,
    winner_id,
    settings,
    team_timeline,
    team_tokens,
    team_score,
    created_at,
    updated_at
  FROM game_sessions;

-- EPIC 10, Story 10.1: Multiplayer Game Flow — Game Sessions & Game Players
--
-- Stores server-authoritative game state. The deck column is excluded from
-- the game_sessions_safe view so clients never see upcoming cards.

-- ─────────────────────────────────────────────
-- game_sessions
-- ─────────────────────────────────────────────

CREATE TABLE game_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'finished', 'abandoned')),
  deck             INTEGER[] NOT NULL,
  deck_cursor      INTEGER NOT NULL DEFAULT 0,
  current_turn     JSONB,
  turn_number      INTEGER NOT NULL DEFAULT 0,
  turn_order       UUID[] NOT NULL,
  active_player_id UUID REFERENCES auth.users(id),
  winner_id        UUID REFERENCES auth.users(id),
  settings         JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_game_sessions_room   ON game_sessions (room_id);
CREATE INDEX idx_game_sessions_status ON game_sessions (status);

CREATE TRIGGER set_game_sessions_updated_at
  BEFORE UPDATE ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- game_players
-- ─────────────────────────────────────────────

CREATE TABLE game_players (
  game_session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  tokens          SMALLINT NOT NULL DEFAULT 2,
  score           SMALLINT NOT NULL DEFAULT 0,
  turn_position   SMALLINT NOT NULL,
  timeline        JSONB NOT NULL DEFAULT '[]'::JSONB,
  PRIMARY KEY (game_session_id, user_id)
);

ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_game_players_session ON game_players (game_session_id);

-- ─────────────────────────────────────────────
-- RLS policies
-- ─────────────────────────────────────────────

-- Session members can read game sessions (deck excluded via view)
CREATE POLICY "Members can read game session"
  ON game_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players gp
      WHERE gp.game_session_id = game_sessions.id
        AND gp.user_id = (SELECT auth.uid())
    )
  );

-- Session members can read all player rows for their session
CREATE POLICY "Members can read game players"
  ON game_players FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players gp
      WHERE gp.game_session_id = game_players.game_session_id
        AND gp.user_id = (SELECT auth.uid())
    )
  );

-- ─────────────────────────────────────────────
-- Safe view — deck excluded
-- ─────────────────────────────────────────────

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
    created_at,
    updated_at
  FROM game_sessions;

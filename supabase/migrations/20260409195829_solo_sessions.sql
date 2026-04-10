-- EPIC 3, Story 3.3: Solo Mode Core Gameplay — Solo Session Table
--
-- Stores server-authoritative game session state for solo mode.
-- The client only holds the session UUID; all deck and timeline data
-- live here so the client cannot see upcoming cards.

CREATE TABLE solo_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Difficulty tier for this session
  difficulty          TEXT NOT NULL
                      CHECK (difficulty IN ('easy', 'medium', 'hard', 'extreme')),

  -- Session lifecycle
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'game_over')),

  -- Running statistics
  score               INTEGER NOT NULL DEFAULT 0,
  turns_played        INTEGER NOT NULL DEFAULT 0,
  best_streak         INTEGER NOT NULL DEFAULT 0,
  current_streak      INTEGER NOT NULL DEFAULT 0,

  -- Shuffled deck: array of game IDs still to be played.
  -- deck[0] (1-indexed in PostgreSQL: deck[1]) is the current card being placed.
  -- After a correct placement, deck[1] is removed and the next element becomes current.
  deck                BIGINT[] NOT NULL,

  -- Timeline: chronologically ordered cards already placed.
  -- Each element: {"game_id": <bigint>, "release_year": <int>}
  timeline            JSONB NOT NULL DEFAULT '[]',

  -- Game over details (set when an incorrect placement ends the game)
  failed_game_id      BIGINT REFERENCES games(id),
  failed_position     INTEGER, -- 0-indexed position where the failing card was placed

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_solo_sessions_updated_at
  BEFORE UPDATE ON solo_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sessions expire naturally; add an index for cleanup queries.
CREATE INDEX idx_solo_sessions_created ON solo_sessions (created_at);

-- RLS enabled — no public policies.
-- Only the service role key (used by Edge Functions) can read/write sessions.
-- This prevents clients from inspecting other sessions or the deck.
ALTER TABLE solo_sessions ENABLE ROW LEVEL SECURITY;

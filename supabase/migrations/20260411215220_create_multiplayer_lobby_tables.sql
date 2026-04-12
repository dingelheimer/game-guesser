-- EPIC 9, Story 9.1: Multiplayer Lobby & Presence — Rooms and Room Players
--
-- Stores lobby membership and settings for multiplayer rooms.

CREATE TABLE rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  host_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'lobby'
              CHECK (status IN ('lobby', 'playing', 'finished', 'abandoned')),
  settings    JSONB NOT NULL DEFAULT '{}'::JSONB,
  max_players SMALLINT NOT NULL DEFAULT 10,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_rooms_code ON rooms (code) WHERE status = 'lobby';
CREATE INDEX idx_rooms_host ON rooms (host_id);
CREATE INDEX idx_rooms_status ON rooms (status);

CREATE TRIGGER set_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE room_players (
  room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'player'
               CHECK (role IN ('host', 'player')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_room_players_user ON room_players (user_id);

CREATE OR REPLACE FUNCTION is_room_member(check_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM room_players
    WHERE room_id = check_room_id
      AND user_id = (SELECT auth.uid())
  );
$$;

CREATE POLICY "Anyone can read lobby room by code" ON rooms
  FOR SELECT TO authenticated
  USING (status = 'lobby');

CREATE POLICY "Members can read room" ON rooms
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM room_players
      WHERE room_id = rooms.id
        AND user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Host can update room" ON rooms
  FOR UPDATE TO authenticated
  USING (host_id = (SELECT auth.uid()))
  WITH CHECK (host_id = (SELECT auth.uid()));

CREATE POLICY "Members can read players" ON room_players
  FOR SELECT TO authenticated
  USING ((SELECT is_room_member(room_id)));

CREATE POLICY "Users can join rooms" ON room_players
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can leave rooms" ON room_players
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Host can kick players" ON room_players
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM rooms
      WHERE id = room_players.room_id
        AND host_id = (SELECT auth.uid())
    )
  );

-- EPIC 9, Story 9.4: Multiplayer Lobby & Presence — Leave Room RPC
--
-- Handles leave-room membership cleanup and host transfer inside one database
-- transaction so the lobby never has a window where it has no host.

CREATE OR REPLACE FUNCTION leave_room(target_room_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := (SELECT auth.uid());
  current_role TEXT;
  next_host_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN 'unauthorized';
  END IF;

  PERFORM 1
  FROM rooms
  WHERE id = target_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  SELECT role
  INTO current_role
  FROM room_players
  WHERE room_id = target_room_id
    AND user_id = current_user_id
  FOR UPDATE;

  IF current_role IS NULL THEN
    RETURN 'not_member';
  END IF;

  DELETE FROM room_players
  WHERE room_id = target_room_id
    AND user_id = current_user_id;

  IF current_role <> 'host' THEN
    RETURN 'left';
  END IF;

  SELECT user_id
  INTO next_host_id
  FROM room_players
  WHERE room_id = target_room_id
  ORDER BY joined_at ASC, user_id ASC
  LIMIT 1;

  IF next_host_id IS NULL THEN
    UPDATE rooms
    SET status = 'abandoned'
    WHERE id = target_room_id;

    RETURN 'abandoned';
  END IF;

  UPDATE room_players
  SET role = 'host'
  WHERE room_id = target_room_id
    AND user_id = next_host_id;

  UPDATE rooms
  SET host_id = next_host_id
  WHERE id = target_room_id;

  RETURN 'transferred';
END;
$$;

REVOKE ALL ON FUNCTION leave_room(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION leave_room(UUID) TO authenticated;

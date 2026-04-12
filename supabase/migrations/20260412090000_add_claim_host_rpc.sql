-- EPIC 9, Story 9.9: Multiplayer Lobby & Presence — Claim Host on Disconnect
--
-- Transfers host ownership to the earliest-joined non-host player when the
-- current host has disconnected and the grace period has expired.
-- Returns JSONB: { status: text, new_host_id?: uuid }

CREATE OR REPLACE FUNCTION claim_host(
  target_room_id   UUID,
  expected_host_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := (SELECT auth.uid());
  current_host_id UUID;
  next_host_id    UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  -- Lock the room row and read the current host
  SELECT host_id
  INTO   current_host_id
  FROM   rooms
  WHERE  id     = target_room_id
    AND  status = 'lobby'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Caller must be a room member
  IF NOT EXISTS (
    SELECT 1
    FROM   room_players
    WHERE  room_id = target_room_id
      AND  user_id = current_user_id
  ) THEN
    RETURN jsonb_build_object('status', 'not_member');
  END IF;

  -- Caller cannot claim host if they are already the host
  IF current_host_id = current_user_id THEN
    RETURN jsonb_build_object('status', 'already_host');
  END IF;

  -- Race-condition guard: abort if the host changed since the client checked
  IF current_host_id IS DISTINCT FROM expected_host_id THEN
    RETURN jsonb_build_object('status', 'host_changed');
  END IF;

  -- Find the earliest-joined non-host player to promote
  SELECT user_id
  INTO   next_host_id
  FROM   room_players
  WHERE  room_id = target_room_id
    AND  user_id != expected_host_id
  ORDER BY joined_at ASC, user_id ASC
  LIMIT 1;

  IF next_host_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_players');
  END IF;

  -- Downgrade the old host's role
  UPDATE room_players
  SET    role = 'player'
  WHERE  room_id = target_room_id
    AND  user_id = expected_host_id;

  -- Promote the new host
  UPDATE room_players
  SET    role = 'host'
  WHERE  room_id = target_room_id
    AND  user_id = next_host_id;

  -- Update the room's host reference
  UPDATE rooms
  SET    host_id = next_host_id
  WHERE  id = target_room_id;

  RETURN jsonb_build_object('status', 'transferred', 'new_host_id', next_host_id);
END;
$$;

REVOKE ALL   ON FUNCTION claim_host(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_host(UUID, UUID) TO authenticated;

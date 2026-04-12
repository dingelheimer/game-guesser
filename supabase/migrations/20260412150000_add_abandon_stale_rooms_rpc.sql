-- EPIC 17, Story 17.2: Bug Fixes — Add abandon_stale_rooms RPC
--
-- Marks all lobby/playing rooms owned by the calling user as abandoned if
-- their updated_at timestamp is older than the configurable threshold.
-- Deletes the calling user's room_players rows for each abandoned room.
-- Returns the count of rooms that were abandoned.

CREATE OR REPLACE FUNCTION abandon_stale_rooms(
  stale_threshold_hours INT DEFAULT 2
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := (SELECT auth.uid());
  abandoned_ids   UUID[];
  abandoned_count INT;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Mark stale rooms as abandoned and collect their IDs
  WITH updated AS (
    UPDATE rooms
    SET    status = 'abandoned'
    WHERE  host_id    = current_user_id
      AND  status     IN ('lobby', 'playing')
      AND  updated_at < NOW() - (stale_threshold_hours || ' hours')::INTERVAL
    RETURNING id
  )
  SELECT array_agg(id), COUNT(*)::INT
  INTO   abandoned_ids, abandoned_count
  FROM   updated;

  -- Remove the calling user's room_players rows for abandoned rooms
  IF abandoned_ids IS NOT NULL THEN
    DELETE FROM room_players
    WHERE user_id = current_user_id
      AND room_id = ANY(abandoned_ids);
  END IF;

  RETURN COALESCE(abandoned_count, 0);
END;
$$;

REVOKE ALL   ON FUNCTION abandon_stale_rooms(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION abandon_stale_rooms(INT) TO authenticated;

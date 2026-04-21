-- Atomically appends a user ID to the acceptedPlayerIds array in current_turn.
--
-- Guards (CAS):
--   - phase must be 'challenge_window'
--   - challengerId must be absent (no active challenge)
--   - user_id must not already be in acceptedPlayerIds (idempotency guard)
--
-- Returns the updated acceptedPlayerIds array, or NULL if the CAS guard failed.
-- Security: SECURITY DEFINER + revoke from public prevents direct client calls.
CREATE OR REPLACE FUNCTION append_accepted_player_id(
  p_session_id   uuid,
  p_turn_number  integer,
  p_user_id      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accepted jsonb;
BEGIN
  UPDATE game_sessions
  SET current_turn = jsonb_set(
    current_turn,
    '{acceptedPlayerIds}',
    COALESCE(current_turn -> 'acceptedPlayerIds', '[]'::jsonb) || to_jsonb(p_user_id)
  )
  WHERE id            = p_session_id
    AND turn_number   = p_turn_number
    AND current_turn ->> 'phase'       = 'challenge_window'
    AND current_turn ->  'challengerId' IS NULL
    AND NOT (COALESCE(current_turn -> 'acceptedPlayerIds', '[]'::jsonb) @> to_jsonb(p_user_id))
  RETURNING current_turn -> 'acceptedPlayerIds'
  INTO v_accepted;

  RETURN v_accepted;
END;
$$;

-- Prevent anonymous / authenticated users from calling this function directly.
-- It is only invoked by the service-role key from the Next.js server actions.
REVOKE EXECUTE ON FUNCTION append_accepted_player_id(uuid, integer, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION append_accepted_player_id(uuid, integer, text) TO service_role;

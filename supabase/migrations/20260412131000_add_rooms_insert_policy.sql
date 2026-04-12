-- EPIC 9 hotfix: allow authenticated users to create lobby rooms under RLS.
--
-- Without this policy, createRoom() reaches the database but the INSERT into
-- rooms is rejected because RLS is enabled and rooms only had SELECT/UPDATE
-- policies.

CREATE POLICY "Users can create rooms" ON rooms
  FOR INSERT TO authenticated
  WITH CHECK (host_id = (SELECT auth.uid()));

-- ATLAS Creator content workspace is persisted only by the server-side
-- atlas-creator Edge Function through the service_role client. Browser roles
-- must never read or mutate this table directly.

ALTER TABLE public.creator_content_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creator_content_workspaces_service_role_only"
  ON public.creator_content_workspaces;

CREATE POLICY "creator_content_workspaces_service_role_only"
  ON public.creator_content_workspaces
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY "creator_content_workspaces_service_role_only"
  ON public.creator_content_workspaces
  IS 'ATLAS Creator workspace persistence is service-role only; browser roles are explicitly denied.';

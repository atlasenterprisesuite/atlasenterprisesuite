-- Harden the remaining Advisory SECURITY DEFINER functions without changing their bodies.
-- Existing advisory write RPCs are hardened by the preceding corrective migration.
alter function public.advisory_bootstrap_default_firm()
  set search_path = pg_catalog, public, pg_temp;
alter function public.advisory_log_audit()
  set search_path = pg_catalog, public, pg_temp;

-- Do not grant table writes to authenticated: the original migration explicitly
-- revokes all table privileges and re-grants SELECT only.
-- Runtime ACL and function-owner verification remain required in isolated PostgreSQL.

-- Trigger entrypoint must not remain executable through PostgreSQL's default PUBLIC grant.
revoke all on function public.advisory_log_audit() from public, anon, authenticated;

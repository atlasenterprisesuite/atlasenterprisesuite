drop policy if exists atlas_ai_repair_jobs_insert on public.atlas_ai_repair_jobs;
create policy atlas_ai_repair_jobs_insert on public.atlas_ai_repair_jobs
for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and status = 'pending'
  and attempts = 0
  and claimed_by is null
  and plan is null
  and result is null
  and branch_name is null
  and pull_request_url is null
  and source_commit is null
  and public.has_org_role(org_id, array['owner'::text,'admin'::text])
);

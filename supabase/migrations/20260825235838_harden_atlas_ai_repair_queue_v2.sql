create index if not exists idx_atlas_ai_repair_jobs_requested_by on public.atlas_ai_repair_jobs(requested_by);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='atlas_ai_repair_jobs_request_text_length' and conrelid='public.atlas_ai_repair_jobs'::regclass) then
    alter table public.atlas_ai_repair_jobs add constraint atlas_ai_repair_jobs_request_text_length check (length(trim(request_text)) between 3 and 12000);
  end if;
  if not exists (select 1 from pg_constraint where conname='atlas_ai_repair_jobs_context_size' and conrelid='public.atlas_ai_repair_jobs'::regclass) then
    alter table public.atlas_ai_repair_jobs add constraint atlas_ai_repair_jobs_context_size check (octet_length(context::text) <= 90000);
  end if;
end $$;

drop policy if exists atlas_ai_repair_jobs_insert on public.atlas_ai_repair_jobs;
create policy atlas_ai_repair_jobs_insert on public.atlas_ai_repair_jobs
for insert to authenticated
with check (
  requested_by = auth.uid()
  and status = 'pending'
  and attempts = 0
  and claimed_by is null
  and plan is null
  and result is null
  and branch_name is null
  and pull_request_url is null
  and source_commit is null
  and public.has_org_role(org_id, array['owner','admin']::text[])
);

revoke insert on public.atlas_ai_repair_jobs from authenticated;
grant insert (org_id, requested_by, request_text, context) on public.atlas_ai_repair_jobs to authenticated;

create or replace function public.atlas_enqueue_repair_job(p_org_id uuid, p_request_text text, p_context jsonb default '{}'::jsonb)
returns public.atlas_ai_repair_jobs
language plpgsql
security invoker
set search_path = public
as $$
declare v_job public.atlas_ai_repair_jobs;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.has_org_role(p_org_id, array['owner','admin']::text[]) then raise exception 'owner_or_admin_required'; end if;
  if length(trim(coalesce(p_request_text,''))) < 3 then raise exception 'repair_request_too_short'; end if;
  if length(p_request_text) > 12000 then raise exception 'repair_request_too_large'; end if;
  if octet_length(coalesce(p_context,'{}'::jsonb)::text) > 90000 then raise exception 'repair_context_too_large'; end if;
  insert into public.atlas_ai_repair_jobs(org_id,requested_by,request_text,context)
  values(p_org_id,auth.uid(),trim(p_request_text),coalesce(p_context,'{}'::jsonb)) returning * into v_job;
  return v_job;
end $$;
revoke all on function public.atlas_enqueue_repair_job(uuid,text,jsonb) from public, anon;
grant execute on function public.atlas_enqueue_repair_job(uuid,text,jsonb) to authenticated;

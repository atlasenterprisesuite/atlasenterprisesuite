create table if not exists public.atlas_ai_repair_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  request_text text not null,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','claimed','planning','applying','completed','failed','cancelled')),
  claimed_by text,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 10),
  plan jsonb,
  result jsonb,
  branch_name text,
  pull_request_url text,
  source_commit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);
create index if not exists idx_atlas_ai_repair_jobs_status_created on public.atlas_ai_repair_jobs(status, created_at);
create index if not exists idx_atlas_ai_repair_jobs_org_created on public.atlas_ai_repair_jobs(org_id, created_at desc);
alter table public.atlas_ai_repair_jobs enable row level security;
drop policy if exists atlas_ai_repair_jobs_read on public.atlas_ai_repair_jobs;
create policy atlas_ai_repair_jobs_read on public.atlas_ai_repair_jobs for select using (public.is_org_member(org_id));
revoke insert, update, delete on public.atlas_ai_repair_jobs from anon, authenticated;
grant select on public.atlas_ai_repair_jobs to authenticated;

create or replace function public.atlas_enqueue_repair_job(p_org_id uuid, p_request_text text, p_context jsonb default '{}'::jsonb)
returns public.atlas_ai_repair_jobs
language plpgsql
security definer
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

create or replace function public.atlas_claim_repair_job(p_runner text)
returns table(id uuid, org_id uuid, request_text text, context jsonb, attempts integer, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  select j.id into v_id from public.atlas_ai_repair_jobs j
   where j.status='pending' and j.attempts < 3
   order by j.created_at asc
   for update skip locked limit 1;
  if v_id is null then return; end if;
  update public.atlas_ai_repair_jobs j set status='claimed',claimed_by=left(coalesce(p_runner,'github-actions'),200),claimed_at=now(),attempts=j.attempts+1,updated_at=now()
   where j.id=v_id;
  return query select j.id,j.org_id,j.request_text,j.context,j.attempts,j.created_at from public.atlas_ai_repair_jobs j where j.id=v_id;
end $$;
revoke all on function public.atlas_claim_repair_job(text) from public, anon, authenticated;
grant execute on function public.atlas_claim_repair_job(text) to service_role;

create or replace function public.atlas_finish_repair_job(p_id uuid,p_status text,p_plan jsonb default null,p_result jsonb default null,p_branch_name text default null,p_pull_request_url text default null,p_source_commit text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_status not in ('planning','applying','completed','failed','cancelled') then raise exception 'invalid_status'; end if;
  update public.atlas_ai_repair_jobs set status=p_status,plan=coalesce(p_plan,plan),result=coalesce(p_result,result),branch_name=coalesce(p_branch_name,branch_name),pull_request_url=coalesce(p_pull_request_url,pull_request_url),source_commit=coalesce(p_source_commit,source_commit),updated_at=now(),completed_at=case when p_status in ('completed','failed','cancelled') then now() else completed_at end where id=p_id;
end $$;
revoke all on function public.atlas_finish_repair_job(uuid,text,jsonb,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.atlas_finish_repair_job(uuid,text,jsonb,jsonb,text,text,text) to service_role;

comment on table public.atlas_ai_repair_jobs is 'ATLAS IA authenticated website-to-repository repair queue. GitHub Actions claims jobs using verified OIDC through the repair bridge.';

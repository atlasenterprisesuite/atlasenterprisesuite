drop policy if exists creator_productions_member_read on public.creator_productions;
create policy creator_productions_member_read
on public.creator_productions
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = creator_productions.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists creator_provider_instances_member_read on public.creator_provider_instances;
create policy creator_provider_instances_member_read
on public.creator_provider_instances
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = creator_provider_instances.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists creator_generation_jobs_member_read on public.creator_generation_jobs;
create policy creator_generation_jobs_member_read
on public.creator_generation_jobs
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = creator_generation_jobs.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

drop policy if exists creator_assets_member_read on public.creator_assets;
create policy creator_assets_member_read
on public.creator_assets
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = creator_assets.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

create index if not exists creator_generation_jobs_production_id_idx
  on public.creator_generation_jobs (production_id);

create index if not exists creator_assets_production_id_idx
  on public.creator_assets (production_id);

create index if not exists creator_assets_generation_job_id_idx
  on public.creator_assets (generation_job_id);

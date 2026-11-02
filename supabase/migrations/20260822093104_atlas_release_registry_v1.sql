create table if not exists public.atlas_release_registry (
  id uuid primary key default gen_random_uuid(),
  release_key text not null unique,
  version text not null,
  release_status text not null check (release_status in ('deployed','verified','rolled_back')),
  web_function text not null,
  web_function_version integer not null,
  runtime_function_version integer not null,
  system_hub_version integer not null,
  web_artifact_sha256 text not null,
  runtime_artifact_sha256 text not null,
  hub_artifact_sha256 text not null,
  release_notes text,
  released_at timestamptz not null default now()
);
alter table public.atlas_release_registry enable row level security;
drop policy if exists atlas_release_registry_read on public.atlas_release_registry;
create policy atlas_release_registry_read on public.atlas_release_registry for select to authenticated using (true);
insert into public.atlas_release_registry(release_key,version,release_status,web_function,web_function_version,runtime_function_version,system_hub_version,web_artifact_sha256,runtime_artifact_sha256,hub_artifact_sha256,release_notes)
values ('enterprise-web-2026-08-22','2026.08.22.1','deployed','atlas-enterprise-web',1,2,4,'8ceba1d0796818723b28e2497847d1e0430240ed6a62b8df8926984baedf60d0','29d1ce0791341fdc0bb68a9f2b1a36ec9d13b50a67648202b5d26e785f5e0f91','c14320c0519e6099b062bfb3537c61602d471cc854ce6645079fd9f443e9418a','Professional ATLAS Enterprise Web, Sovereign Runtime v2 governance, and System Hub v4 integration. External HTTP verification pending due tool DNS resolution failure.')
on conflict (release_key) do update set version=excluded.version,release_status=excluded.release_status,web_function=excluded.web_function,web_function_version=excluded.web_function_version,runtime_function_version=excluded.runtime_function_version,system_hub_version=excluded.system_hub_version,web_artifact_sha256=excluded.web_artifact_sha256,runtime_artifact_sha256=excluded.runtime_artifact_sha256,hub_artifact_sha256=excluded.hub_artifact_sha256,release_notes=excluded.release_notes,released_at=now();

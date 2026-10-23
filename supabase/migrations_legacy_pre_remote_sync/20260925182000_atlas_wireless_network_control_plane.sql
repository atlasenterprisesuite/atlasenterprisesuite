-- ATLAS Wireless owned-network control plane.
-- Source of truth for organization-scoped infrastructure inventory and readiness evidence.
-- Browser access is read-only through RLS; mutation remains server/governance controlled.

create table if not exists public.wireless_network_profiles (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  network_mode text not null default 'atlas-owned'
    check (network_mode in ('atlas-owned','hybrid','wholesale-fallback')),
  wholesale_provider_ready boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.wireless_network_components (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  layer text not null
    check (layer in ('core','ran','spectrum','backhaul','edge','sim_esim','interconnect','emergency_services','observability')),
  state text not null default 'not_configured'
    check (state in ('not_configured','planned','configured_unverified','ready','degraded','offline','disabled')),
  blocker text,
  checked_at timestamptz,
  evidence_refs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (org_id, layer),
  check (jsonb_typeof(evidence_refs) = 'array')
);

create table if not exists public.wireless_ran_sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radio_technology text not null check (radio_technology in ('5g-nr','lte')),
  spectrum_access text not null check (spectrum_access in ('cbrs-gaa','cbrs-pal','licensed','unlicensed-lab')),
  state text not null default 'planned'
    check (state in ('not_configured','planned','configured_unverified','ready','degraded','offline','disabled')),
  evidence_refs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(evidence_refs) = 'array')
);

create table if not exists public.wireless_spectrum_authorizations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  access_model text not null check (access_model in ('cbrs-gaa','cbrs-pal','licensed','experimental')),
  authority text not null,
  authorization_reference text,
  sas_provider text,
  state text not null default 'planned'
    check (state in ('not_configured','planned','configured_unverified','ready','degraded','offline','disabled')),
  evidence_refs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(evidence_refs) = 'array')
);

create table if not exists public.wireless_backhaul_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  medium text not null check (medium in ('fiber','ethernet','microwave','fixed-wireless','satellite')),
  redundant boolean not null default false,
  state text not null default 'planned'
    check (state in ('not_configured','planned','configured_unverified','ready','degraded','offline','disabled')),
  evidence_refs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(evidence_refs) = 'array')
);

alter table public.wireless_network_profiles enable row level security;
alter table public.wireless_network_components enable row level security;
alter table public.wireless_ran_sites enable row level security;
alter table public.wireless_spectrum_authorizations enable row level security;
alter table public.wireless_backhaul_links enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'wireless_network_profiles',
    'wireless_network_components',
    'wireless_ran_sites',
    'wireless_spectrum_authorizations',
    'wireless_backhaul_links'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_read', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (exists (select 1 from public.organization_members om where om.org_id = %I.org_id and om.user_id = auth.uid() and om.status = ''active''))',
      table_name || '_read',
      table_name,
      table_name
    );
  end loop;
end $$;

revoke insert, update, delete on public.wireless_network_profiles from authenticated;
revoke insert, update, delete on public.wireless_network_components from authenticated;
revoke insert, update, delete on public.wireless_ran_sites from authenticated;
revoke insert, update, delete on public.wireless_spectrum_authorizations from authenticated;
revoke insert, update, delete on public.wireless_backhaul_links from authenticated;

grant select on public.wireless_network_profiles to authenticated;
grant select on public.wireless_network_components to authenticated;
grant select on public.wireless_ran_sites to authenticated;
grant select on public.wireless_spectrum_authorizations to authenticated;
grant select on public.wireless_backhaul_links to authenticated;

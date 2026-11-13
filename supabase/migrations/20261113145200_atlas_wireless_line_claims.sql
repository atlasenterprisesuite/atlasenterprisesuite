-- ATLAS Wireless: private intake for a self-attested line, NOT numbering resources.
-- No implicit proof of control, provider allocation, cellular service, or portability.
create table if not exists public.atlas_wireless_line_claims (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  e164 text not null check (e164 ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'),
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'withdrawn')),
  ownership_asserted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, submitted_by, e164)
);

create index if not exists atlas_wireless_line_claims_submitter_idx
  on public.atlas_wireless_line_claims(org_id, submitted_by, created_at desc);

alter table public.atlas_wireless_line_claims enable row level security;
-- No client SELECT/INSERT/UPDATE/DELETE. The authenticated edge path checks
-- active membership, wireless.mvno.read, and ownership before the service role.
revoke all on public.atlas_wireless_line_claims from public, anon, authenticated;

comment on table public.atlas_wireless_line_claims is
  'Private self-attested line enrollment only. Records are always unverified; never treat them as carrier allocation, active cellular service, or proof of ownership.';

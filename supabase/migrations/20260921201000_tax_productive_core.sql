-- ATLAS Tax productive core: durable return state, tax-fact ledger, workpapers,
-- diagnostics, carryforwards, source-to-line mappings and immutable snapshots.
-- Browser writes are RPC-only and organization-scoped. No filing/transmission rail is enabled here.

insert into public.identity_permissions (code, description)
values
  ('tax.read', 'Read ATLAS Tax clients, returns, tax facts, workpapers, diagnostics and snapshots.'),
  ('tax.prepare', 'Create and prepare ATLAS Tax returns and tax facts.'),
  ('tax.review', 'Review ATLAS Tax returns, diagnostics, workpapers and overrides.'),
  ('tax.file', 'Authorize filing-package preparation after review and signature gates.'),
  ('tax.admin', 'Administer ATLAS Tax configuration and professional workflow.')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner','tax.read'), ('owner','tax.prepare'), ('owner','tax.review'), ('owner','tax.file'), ('owner','tax.admin'),
  ('admin','tax.read'), ('admin','tax.prepare'), ('admin','tax.review'), ('admin','tax.file'), ('admin','tax.admin'),
  ('viewer','tax.read')
on conflict do nothing;

create table if not exists public.tax_returns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  firm_id uuid not null references public.advisory_firms(id) on delete restrict,
  client_id uuid not null references public.advisory_clients(id) on delete restrict,
  engagement_id uuid references public.advisory_engagements(id) on delete set null,
  tax_year integer not null check (tax_year between 2000 and 2200),
  return_kind text not null check (return_kind in ('1040','1065','1120-S','1120','1041')),
  jurisdiction text not null default 'US-FED' check (length(trim(jurisdiction)) between 2 and 64),
  status text not null default 'organizer'
    check (status in (
      'organizer','waiting_on_client','preparation','review','signature',
      'ready_to_file','transmitted','accepted','rejected','extension',
      'amended','closed','archived'
    )),
  current_step_id text not null default 'engagement',
  preparer_user_id uuid references auth.users(id),
  reviewer_user_id uuid references auth.users(id),
  revision integer not null default 1 check (revision > 0),
  original_return_id uuid references public.tax_returns(id) on delete restrict,
  filed_at timestamptz,
  accepted_at timestamptz,
  locked_at timestamptz,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, client_id, tax_year, return_kind, jurisdiction, revision),
  check (original_return_id is null or original_return_id <> id)
);

create table if not exists public.tax_return_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  return_id uuid not null references public.tax_returns(id) on delete cascade,
  step_id text not null check (length(trim(step_id)) between 1 and 80),
  state text not null default 'not_started'
    check (state in ('not_started','in_progress','review','blocked','complete')),
  note text,
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (return_id, step_id),
  check ((state = 'complete' and completed_at is not null) or state <> 'complete')
);

create table if not exists public.tax_source_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  return_id uuid not null references public.tax_returns(id) on delete cascade,
  document_type text not null check (length(trim(document_type)) between 1 and 80),
  tax_year integer not null check (tax_year between 2000 and 2200),
  issuer_name text,
  issuer_reference_last4 text check (issuer_reference_last4 is null or issuer_reference_last4 ~ '^[A-Za-z0-9]{1,8}$'),
  correction_status text not null default 'original'
    check (correction_status in ('original','corrected','voided','superseded')),
  extraction_status text not null default 'manual'
    check (extraction_status in ('manual','proposed','reviewed','verified','rejected')),
  external_asset_reference text,
  source_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tax_facts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  return_id uuid not null references public.tax_returns(id) on delete cascade,
  tax_fact_key text not null check (length(trim(tax_fact_key)) between 3 and 200),
  jurisdiction text not null default 'US-FED' check (length(trim(jurisdiction)) between 2 and 64),
  subject_key text not null default 'primary' check (length(trim(subject_key)) between 1 and 120),
  value jsonb not null,
  unit text,
  source_document_id uuid references public.tax_source_documents(id) on delete set null,
  source_field text,
  mapping_treatment text not null default 'direct'
    check (mapping_treatment in ('direct','derived','informational','jurisdiction','review','override')),
  rule_pack_version text,
  evidence_reference text,
  review_state text not null default 'unreviewed'
    check (review_state in ('unreviewed','review','approved','rejected','overridden')),
  version integer not null default 1 check (version > 0),
  is_current boolean not null default true,
  supersedes_fact_id uuid references public.tax_facts(id) on delete restrict,
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (return_id, tax_fact_key, subject_key, jurisdiction, version),
  check (supersedes_fact_id is null or supersedes_fact_id <> id)
);

create unique index if not exists tax_facts_current_key_idx
  on public.tax_facts(return_id, tax_fact_key, subject_key, jurisdiction)
  where is_current;

create table if not exists public.tax_line_mappings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  return_id uuid not null references public.tax_returns(id) on delete cascade,
  tax_fact_id uuid not null references public.tax_facts(id) on delete cascade,
  form_id text not null check (length(trim(form_id)) between 1 and 120),
  form_revision text,
  destination_line text,
  destination_field text not null check (length(trim(destination_field)) between 1 and 160),
  contribution_role text not null default 'input'
    check (contribution_role in ('input','subtotal','limit','credit','payment','informational','carryforward')),
  mapped_value jsonb,
  calculation_reference text,
  rule_pack_version text,
  review_required boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.tax_workpapers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  return_id uuid not null references public.tax_returns(id) on delete cascade,
  workpaper_key text not null check (length(trim(workpaper_key)) between 2 and 160),
  workpaper_type text not null
    check (workpaper_type in (
      'reconciliation','worksheet','basis','depreciation','book_to_tax',
      'carryforward','state_apportionment','international','due_diligence','other'
    )),
  status text not null default 'open'
    check (status in ('open','reconciled','review','approved','blocked')),
  data jsonb not null default '{}'::jsonb,
  source_total numeric,
  return_total numeric,
  variance numeric generated always as (
    case when source_total is null or return_total is null then null else return_total - source_total end
  ) stored,
  evidence_reference text,
  prepared_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (return_id, workpaper_key)
);

create table if not exists public.tax_diagnostics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  return_id uuid not null references public.tax_returns(id) on delete cascade,
  diagnostic_code text not null check (length(trim(diagnostic_code)) between 2 and 120),
  severity text not null check (severity in ('info','warning','error','fatal')),
  blocking boolean not null default false,
  source_reference text,
  form_reference text,
  message text not null check (length(trim(message)) > 0),
  status text not null default 'open' check (status in ('open','resolved','accepted_override')),
  resolution_note text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (return_id, diagnostic_code, source_reference, form_reference)
);

create table if not exists public.tax_carryforwards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.advisory_clients(id) on delete cascade,
  source_return_id uuid not null references public.tax_returns(id) on delete restrict,
  carryforward_key text not null check (length(trim(carryforward_key)) between 2 and 160),
  source_tax_year integer not null check (source_tax_year between 2000 and 2200),
  available_tax_year integer not null check (available_tax_year between 2000 and 2200),
  expiration_tax_year integer check (expiration_tax_year between 2000 and 2200),
  jurisdiction text not null default 'US-FED',
  value jsonb not null,
  status text not null default 'available'
    check (status in ('available','partially_used','used','expired','superseded')),
  consumed_by_return_id uuid references public.tax_returns(id) on delete restrict,
  rule_pack_version text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, carryforward_key, source_tax_year, jurisdiction, source_return_id)
);

create table if not exists public.tax_return_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  return_id uuid not null references public.tax_returns(id) on delete restrict,
  snapshot_kind text not null check (snapshot_kind in ('reviewed','signature','submission','accepted','amended_origin')),
  return_revision integer not null check (return_revision > 0),
  snapshot jsonb not null,
  snapshot_hash text not null check (length(snapshot_hash) >= 32),
  authorization_reference text,
  provider_reference text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (return_id, snapshot_kind, return_revision, snapshot_hash)
);

create table if not exists public.tax_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  return_id uuid references public.tax_returns(id) on delete cascade,
  entity_type text not null check (length(trim(entity_type)) > 0),
  entity_id uuid,
  action text not null check (length(trim(action)) > 0),
  details jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists tax_returns_workqueue_idx
  on public.tax_returns(org_id, firm_id, tax_year, status, updated_at desc);
create index if not exists tax_returns_client_idx
  on public.tax_returns(org_id, client_id, tax_year desc);
create index if not exists tax_steps_return_idx
  on public.tax_return_steps(org_id, return_id, state);
create index if not exists tax_documents_return_idx
  on public.tax_source_documents(org_id, return_id, document_type, created_at desc);
create index if not exists tax_facts_return_idx
  on public.tax_facts(org_id, return_id, is_current, tax_fact_key);
create index if not exists tax_line_mappings_return_idx
  on public.tax_line_mappings(org_id, return_id, form_id, destination_field);
create index if not exists tax_workpapers_return_idx
  on public.tax_workpapers(org_id, return_id, status, workpaper_type);
create index if not exists tax_diagnostics_open_idx
  on public.tax_diagnostics(org_id, return_id, status, blocking, severity);
create index if not exists tax_carryforwards_client_idx
  on public.tax_carryforwards(org_id, client_id, available_tax_year, status);
create index if not exists tax_snapshots_return_idx
  on public.tax_return_snapshots(org_id, return_id, created_at desc);
create index if not exists tax_audit_return_idx
  on public.tax_audit_events(org_id, return_id, created_at desc);

alter table public.tax_returns enable row level security;
alter table public.tax_return_steps enable row level security;
alter table public.tax_source_documents enable row level security;
alter table public.tax_facts enable row level security;
alter table public.tax_line_mappings enable row level security;
alter table public.tax_workpapers enable row level security;
alter table public.tax_diagnostics enable row level security;
alter table public.tax_carryforwards enable row level security;
alter table public.tax_return_snapshots enable row level security;
alter table public.tax_audit_events enable row level security;

drop policy if exists tax_returns_read on public.tax_returns;
create policy tax_returns_read on public.tax_returns for select to authenticated
using (public.has_identity_permission(org_id, 'tax.read'));

drop policy if exists tax_steps_read on public.tax_return_steps;
create policy tax_steps_read on public.tax_return_steps for select to authenticated
using (public.has_identity_permission(org_id, 'tax.read'));

drop policy if exists tax_documents_read on public.tax_source_documents;
create policy tax_documents_read on public.tax_source_documents for select to authenticated
using (public.has_identity_permission(org_id, 'tax.read'));

drop policy if exists tax_facts_read on public.tax_facts;
create policy tax_facts_read on public.tax_facts for select to authenticated
using (public.has_identity_permission(org_id, 'tax.read'));

drop policy if exists tax_line_mappings_read on public.tax_line_mappings;
create policy tax_line_mappings_read on public.tax_line_mappings for select to authenticated
using (public.has_identity_permission(org_id, 'tax.read'));

drop policy if exists tax_workpapers_read on public.tax_workpapers;
create policy tax_workpapers_read on public.tax_workpapers for select to authenticated
using (public.has_identity_permission(org_id, 'tax.read'));

drop policy if exists tax_diagnostics_read on public.tax_diagnostics;
create policy tax_diagnostics_read on public.tax_diagnostics for select to authenticated
using (public.has_identity_permission(org_id, 'tax.read'));

drop policy if exists tax_carryforwards_read on public.tax_carryforwards;
create policy tax_carryforwards_read on public.tax_carryforwards for select to authenticated
using (public.has_identity_permission(org_id, 'tax.read'));

drop policy if exists tax_snapshots_read on public.tax_return_snapshots;
create policy tax_snapshots_read on public.tax_return_snapshots for select to authenticated
using (public.has_identity_permission(org_id, 'tax.read'));

drop policy if exists tax_audit_read on public.tax_audit_events;
create policy tax_audit_read on public.tax_audit_events for select to authenticated
using (public.has_identity_permission(org_id, 'tax.review') or public.has_identity_permission(org_id, 'audit.read'));

revoke all on public.tax_returns from anon, authenticated;
revoke all on public.tax_return_steps from anon, authenticated;
revoke all on public.tax_source_documents from anon, authenticated;
revoke all on public.tax_facts from anon, authenticated;
revoke all on public.tax_line_mappings from anon, authenticated;
revoke all on public.tax_workpapers from anon, authenticated;
revoke all on public.tax_diagnostics from anon, authenticated;
revoke all on public.tax_carryforwards from anon, authenticated;
revoke all on public.tax_return_snapshots from anon, authenticated;
revoke all on public.tax_audit_events from anon, authenticated;

grant select on public.tax_returns, public.tax_return_steps, public.tax_source_documents,
  public.tax_facts, public.tax_line_mappings, public.tax_workpapers, public.tax_diagnostics,
  public.tax_carryforwards, public.tax_return_snapshots, public.tax_audit_events to authenticated;
grant all on public.tax_returns, public.tax_return_steps, public.tax_source_documents,
  public.tax_facts, public.tax_line_mappings, public.tax_workpapers, public.tax_diagnostics,
  public.tax_carryforwards, public.tax_return_snapshots, public.tax_audit_events to service_role;

create or replace function public.tax_actor_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select om.org_id
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.status = 'active'
  order by om.org_id
  limit 1
$$;

revoke all on function public.tax_actor_org() from public;
grant execute on function public.tax_actor_org() to authenticated;

create or replace function public.tax_assert_return_mutable(p_return_id uuid, p_permission text default 'tax.prepare')
returns public.tax_returns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.tax_actor_org();
  v_return public.tax_returns;
begin
  if auth.uid() is null or v_org is null then raise exception 'Authentication and active organization required'; end if;
  if not public.has_identity_permission(v_org, p_permission) then raise exception 'Tax permission required: %', p_permission; end if;

  select * into v_return
  from public.tax_returns r
  where r.id = p_return_id and r.org_id = v_org;

  if v_return.id is null then raise exception 'Tax return not available in active organization'; end if;
  if v_return.locked_at is not null or v_return.status in ('transmitted','accepted','closed','archived') then
    raise exception 'Tax return is locked; create an amendment or new revision';
  end if;
  return v_return;
end
$$;

revoke all on function public.tax_assert_return_mutable(uuid,text) from public;

create or replace function public.tax_create_return(
  p_firm_id uuid,
  p_client_id uuid,
  p_engagement_id uuid,
  p_tax_year integer,
  p_return_kind text,
  p_jurisdiction text default 'US-FED'
)
returns setof public.tax_returns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.tax_actor_org();
  v_return_id uuid;
begin
  if v_user is null or v_org is null then raise exception 'Authentication and active organization required'; end if;
  if not public.has_identity_permission(v_org, 'tax.prepare') then raise exception 'Tax prepare permission required'; end if;
  if p_tax_year not between 2000 and 2200 then raise exception 'Invalid tax year'; end if;
  if p_return_kind not in ('1040','1065','1120-S','1120','1041') then raise exception 'Unsupported return kind'; end if;

  if not exists (
    select 1 from public.advisory_firms f
    where f.id = p_firm_id and f.org_id = v_org and f.status = 'active'
  ) then raise exception 'Firm not available in active organization'; end if;

  if not exists (
    select 1 from public.advisory_clients c
    where c.id = p_client_id and c.org_id = v_org and c.firm_id = p_firm_id and c.status <> 'inactive'
  ) then raise exception 'Client not available in firm'; end if;

  if p_engagement_id is not null and not exists (
    select 1 from public.advisory_engagements e
    where e.id = p_engagement_id and e.org_id = v_org and e.firm_id = p_firm_id and e.client_id = p_client_id
  ) then raise exception 'Engagement not available for client'; end if;

  insert into public.tax_returns(
    org_id, firm_id, client_id, engagement_id, tax_year, return_kind, jurisdiction,
    status, current_step_id, preparer_user_id, created_by, updated_by
  ) values (
    v_org, p_firm_id, p_client_id, p_engagement_id, p_tax_year, p_return_kind, trim(p_jurisdiction),
    'organizer', 'engagement', v_user, v_user, v_user
  )
  returning id into v_return_id;

  insert into public.tax_return_steps(org_id, return_id, step_id, state, updated_by)
  values (v_org, v_return_id, 'engagement', 'in_progress', v_user)
  on conflict (return_id, step_id) do nothing;

  insert into public.tax_audit_events(org_id, return_id, entity_type, entity_id, action, details, actor_user_id)
  values (v_org, v_return_id, 'tax_returns', v_return_id, 'created',
    jsonb_build_object('tax_year', p_tax_year, 'return_kind', p_return_kind, 'jurisdiction', p_jurisdiction), v_user);

  return query select r.* from public.tax_returns r where r.id = v_return_id;
end
$$;

create or replace function public.tax_set_step_state(
  p_return_id uuid,
  p_step_id text,
  p_state text,
  p_note text default null
)
returns setof public.tax_return_steps
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_return public.tax_returns := public.tax_assert_return_mutable(p_return_id,
    case when p_state = 'complete' and p_step_id = 'professional-review' then 'tax.review' else 'tax.prepare' end);
  v_step uuid;
begin
  if length(trim(coalesce(p_step_id,''))) = 0 then raise exception 'Step id required'; end if;
  if p_state not in ('not_started','in_progress','review','blocked','complete') then raise exception 'Invalid step state'; end if;

  insert into public.tax_return_steps(
    org_id, return_id, step_id, state, note, completed_by, completed_at, updated_by, updated_at
  ) values (
    v_return.org_id, p_return_id, trim(p_step_id), p_state, nullif(trim(coalesce(p_note,'')),''),
    case when p_state = 'complete' then v_user else null end,
    case when p_state = 'complete' then now() else null end,
    v_user, now()
  )
  on conflict (return_id, step_id) do update set
    state = excluded.state,
    note = excluded.note,
    completed_by = excluded.completed_by,
    completed_at = excluded.completed_at,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning id into v_step;

  update public.tax_returns
  set current_step_id = trim(p_step_id),
      status = case
        when p_step_id = 'professional-review' then 'review'
        when p_step_id = 'client-review' then 'signature'
        when p_step_id = 'efile' then 'ready_to_file'
        else case when status in ('organizer','waiting_on_client') then 'preparation' else status end
      end,
      updated_by = v_user,
      updated_at = now()
  where id = p_return_id and org_id = v_return.org_id;

  insert into public.tax_audit_events(org_id, return_id, entity_type, entity_id, action, details, actor_user_id)
  values (v_return.org_id, p_return_id, 'tax_return_steps', v_step, 'step_state_changed',
    jsonb_build_object('step_id', p_step_id, 'state', p_state), v_user);

  return query select s.* from public.tax_return_steps s where s.id = v_step;
end
$$;

create or replace function public.tax_register_source_document(
  p_return_id uuid,
  p_document_type text,
  p_tax_year integer,
  p_issuer_name text default null,
  p_external_asset_reference text default null,
  p_source_hash text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns setof public.tax_source_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_return public.tax_returns := public.tax_assert_return_mutable(p_return_id, 'tax.prepare');
  v_id uuid;
begin
  if length(trim(coalesce(p_document_type,''))) = 0 then raise exception 'Document type required'; end if;
  if p_tax_year <> v_return.tax_year then raise exception 'Source document tax year must match return tax year'; end if;

  insert into public.tax_source_documents(
    org_id, return_id, document_type, tax_year, issuer_name,
    extraction_status, external_asset_reference, source_hash, metadata, created_by
  ) values (
    v_return.org_id, p_return_id, trim(p_document_type), p_tax_year,
    nullif(trim(coalesce(p_issuer_name,'')),''),
    'manual', nullif(trim(coalesce(p_external_asset_reference,'')),''),
    nullif(trim(coalesce(p_source_hash,'')),''), coalesce(p_metadata,'{}'::jsonb), v_user
  ) returning id into v_id;

  return query select d.* from public.tax_source_documents d where d.id = v_id;
end
$$;

create or replace function public.tax_record_fact(
  p_return_id uuid,
  p_tax_fact_key text,
  p_value jsonb,
  p_jurisdiction text default 'US-FED',
  p_subject_key text default 'primary',
  p_unit text default null,
  p_source_document_id uuid default null,
  p_source_field text default null,
  p_mapping_treatment text default 'direct',
  p_rule_pack_version text default null,
  p_evidence_reference text default null,
  p_review_state text default 'unreviewed'
)
returns setof public.tax_facts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_return public.tax_returns := public.tax_assert_return_mutable(p_return_id, 'tax.prepare');
  v_previous uuid;
  v_version integer := 1;
  v_id uuid;
begin
  if length(trim(coalesce(p_tax_fact_key,''))) < 3 then raise exception 'Tax fact key required'; end if;
  if p_value is null then raise exception 'Tax fact value required'; end if;
  if p_mapping_treatment not in ('direct','derived','informational','jurisdiction','review','override') then
    raise exception 'Invalid mapping treatment';
  end if;
  if p_review_state not in ('unreviewed','review','approved','rejected','overridden') then raise exception 'Invalid review state'; end if;
  if p_mapping_treatment = 'override' and not public.has_identity_permission(v_return.org_id, 'tax.review') then
    raise exception 'Tax review permission required for overrides';
  end if;
  if p_source_document_id is not null and not exists (
    select 1 from public.tax_source_documents d
    where d.id = p_source_document_id and d.return_id = p_return_id and d.org_id = v_return.org_id
  ) then raise exception 'Source document not available in return'; end if;

  select f.id, f.version + 1 into v_previous, v_version
  from public.tax_facts f
  where f.return_id = p_return_id
    and f.tax_fact_key = trim(p_tax_fact_key)
    and f.subject_key = trim(p_subject_key)
    and f.jurisdiction = trim(p_jurisdiction)
    and f.is_current
  order by f.version desc
  limit 1
  for update;

  if v_previous is not null then
    update public.tax_facts set is_current = false
    where id = v_previous and org_id = v_return.org_id;
  end if;

  insert into public.tax_facts(
    org_id, return_id, tax_fact_key, jurisdiction, subject_key, value, unit,
    source_document_id, source_field, mapping_treatment, rule_pack_version,
    evidence_reference, review_state, version, is_current, supersedes_fact_id,
    created_by, reviewed_by, reviewed_at
  ) values (
    v_return.org_id, p_return_id, trim(p_tax_fact_key), trim(p_jurisdiction), trim(p_subject_key),
    p_value, nullif(trim(coalesce(p_unit,'')),''),
    p_source_document_id, nullif(trim(coalesce(p_source_field,'')),''),
    p_mapping_treatment, nullif(trim(coalesce(p_rule_pack_version,'')),''),
    nullif(trim(coalesce(p_evidence_reference,'')),''),
    p_review_state, coalesce(v_version,1), true, v_previous, v_user,
    case when p_review_state in ('approved','rejected','overridden') then v_user else null end,
    case when p_review_state in ('approved','rejected','overridden') then now() else null end
  ) returning id into v_id;

  update public.tax_returns
  set updated_by = v_user, updated_at = now()
  where id = p_return_id;

  insert into public.tax_audit_events(org_id, return_id, entity_type, entity_id, action, details, actor_user_id)
  values (
    v_return.org_id, p_return_id, 'tax_facts', v_id, 'fact_version_created',
    jsonb_build_object(
      'tax_fact_key', p_tax_fact_key, 'version', coalesce(v_version,1),
      'mapping_treatment', p_mapping_treatment, 'review_state', p_review_state
    ), v_user
  );

  return query select f.* from public.tax_facts f where f.id = v_id;
end
$$;

create or replace function public.tax_import_source_mapping(
  p_return_id uuid,
  p_document_type text,
  p_tax_year integer,
  p_mappings jsonb,
  p_issuer_name text default null,
  p_external_asset_reference text default null,
  p_source_hash text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $
declare
  v_user uuid := auth.uid();
  v_return public.tax_returns := public.tax_assert_return_mutable(p_return_id, 'tax.prepare');
  v_document_id uuid;
  v_mapping jsonb;
  v_fact_id uuid;
  v_fact_key text;
  v_value jsonb;
  v_count integer := 0;
begin
  if p_tax_year <> v_return.tax_year then raise exception 'Source document tax year must match return tax year'; end if;
  if length(trim(coalesce(p_document_type,''))) = 0 then raise exception 'Document type required'; end if;
  if p_mappings is null or jsonb_typeof(p_mappings) <> 'array' then raise exception 'Mappings array required'; end if;

  insert into public.tax_source_documents(
    org_id, return_id, document_type, tax_year, issuer_name,
    extraction_status, external_asset_reference, source_hash, metadata, created_by
  ) values (
    v_return.org_id, p_return_id, trim(p_document_type), p_tax_year,
    nullif(trim(coalesce(p_issuer_name,'')),''),
    'reviewed', nullif(trim(coalesce(p_external_asset_reference,'')),''),
    nullif(trim(coalesce(p_source_hash,'')),''),
    coalesce(p_metadata,'{}'::jsonb), v_user
  ) returning id into v_document_id;

  for v_mapping in select value from jsonb_array_elements(p_mappings)
  loop
    if length(trim(coalesce(v_mapping->>'destinationField',''))) = 0
       or length(trim(coalesce(v_mapping->>'destinationForm',''))) = 0 then
      raise exception 'Every mapping requires destinationField and destinationForm';
    end if;

    v_fact_key := trim(v_mapping->>'destinationField');
    v_value := case
      when v_mapping ? 'amount' then jsonb_build_object('amount', (v_mapping->>'amount')::numeric)
      when v_mapping ? 'value' then v_mapping->'value'
      else 'null'::jsonb
    end;

    insert into public.tax_facts(
      org_id, return_id, tax_fact_key, jurisdiction, subject_key, value, unit,
      source_document_id, source_field, mapping_treatment, rule_pack_version,
      evidence_reference, review_state, version, is_current, created_by
    ) values (
      v_return.org_id,
      p_return_id,
      v_fact_key,
      coalesce(nullif(trim(v_mapping->>'jurisdiction'),''),'federal'),
      'document:' || v_document_id::text,
      v_value,
      case when v_mapping ? 'amount' then 'USD' else null end,
      v_document_id,
      nullif(trim(coalesce(v_mapping->>'source','')),''),
      case
        when v_mapping->>'treatment' in ('direct','derived','informational','jurisdiction','review','override')
          then v_mapping->>'treatment'
        else 'review'
      end,
      nullif(trim(coalesce(v_mapping->>'rulePackVersion','')),''),
      nullif(trim(coalesce(v_mapping->>'reason','')),''),
      case when coalesce((v_mapping->>'reviewRequired')::boolean,false) then 'review' else 'unreviewed' end,
      1,
      true,
      v_user
    ) returning id into v_fact_id;

    insert into public.tax_line_mappings(
      org_id, return_id, tax_fact_id, form_id, form_revision, destination_line,
      destination_field, contribution_role, mapped_value, calculation_reference,
      rule_pack_version, review_required, created_by
    ) values (
      v_return.org_id,
      p_return_id,
      v_fact_id,
      trim(v_mapping->>'destinationForm'),
      nullif(trim(coalesce(v_mapping->>'formRevision','')),''),
      nullif(trim(coalesce(v_mapping->>'destinationLine','')),''),
      v_fact_key,
      case
        when v_mapping->>'treatment' = 'informational' then 'informational'
        when v_mapping->>'treatment' = 'derived' then 'subtotal'
        else 'input'
      end,
      v_value,
      nullif(trim(coalesce(v_mapping->>'reason','')),''),
      nullif(trim(coalesce(v_mapping->>'rulePackVersion','')),''),
      coalesce((v_mapping->>'reviewRequired')::boolean,false),
      v_user
    );

    v_count := v_count + 1;
  end loop;

  update public.tax_returns
  set status = case when status = 'organizer' then 'preparation' else status end,
      current_step_id = 'income-documents',
      updated_by = v_user,
      updated_at = now()
  where id = p_return_id and org_id = v_return.org_id;

  insert into public.tax_audit_events(org_id, return_id, entity_type, entity_id, action, details, actor_user_id)
  values (
    v_return.org_id, p_return_id, 'tax_source_documents', v_document_id, 'source_mapping_imported',
    jsonb_build_object('document_type', p_document_type, 'mapping_count', v_count), v_user
  );

  return jsonb_build_object('document_id', v_document_id, 'mapping_count', v_count);
end
$;

create or replace function public.tax_record_line_mapping(
  p_return_id uuid,
  p_tax_fact_id uuid,
  p_form_id text,
  p_destination_field text,
  p_destination_line text default null,
  p_form_revision text default null,
  p_contribution_role text default 'input',
  p_mapped_value jsonb default null,
  p_calculation_reference text default null,
  p_rule_pack_version text default null,
  p_review_required boolean default false
)
returns setof public.tax_line_mappings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_return public.tax_returns := public.tax_assert_return_mutable(p_return_id, 'tax.prepare');
  v_id uuid;
begin
  if not exists (
    select 1 from public.tax_facts f
    where f.id = p_tax_fact_id and f.return_id = p_return_id and f.org_id = v_return.org_id and f.is_current
  ) then raise exception 'Current tax fact not available in return'; end if;
  if length(trim(coalesce(p_form_id,''))) = 0 or length(trim(coalesce(p_destination_field,''))) = 0 then
    raise exception 'Form and destination field required';
  end if;

  insert into public.tax_line_mappings(
    org_id, return_id, tax_fact_id, form_id, form_revision, destination_line,
    destination_field, contribution_role, mapped_value, calculation_reference,
    rule_pack_version, review_required, created_by
  ) values (
    v_return.org_id, p_return_id, p_tax_fact_id, trim(p_form_id),
    nullif(trim(coalesce(p_form_revision,'')),''),
    nullif(trim(coalesce(p_destination_line,'')),''),
    trim(p_destination_field), p_contribution_role, p_mapped_value,
    nullif(trim(coalesce(p_calculation_reference,'')),''),
    nullif(trim(coalesce(p_rule_pack_version,'')),''),
    p_review_required, v_user
  ) returning id into v_id;

  return query select m.* from public.tax_line_mappings m where m.id = v_id;
end
$$;

create or replace function public.tax_upsert_workpaper(
  p_return_id uuid,
  p_workpaper_key text,
  p_workpaper_type text,
  p_status text,
  p_data jsonb default '{}'::jsonb,
  p_source_total numeric default null,
  p_return_total numeric default null,
  p_evidence_reference text default null
)
returns setof public.tax_workpapers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_return public.tax_returns := public.tax_assert_return_mutable(p_return_id, 'tax.prepare');
  v_id uuid;
begin
  if p_workpaper_type not in ('reconciliation','worksheet','basis','depreciation','book_to_tax','carryforward','state_apportionment','international','due_diligence','other') then
    raise exception 'Invalid workpaper type';
  end if;
  if p_status not in ('open','reconciled','review','approved','blocked') then raise exception 'Invalid workpaper status'; end if;
  if p_status = 'approved' and not public.has_identity_permission(v_return.org_id, 'tax.review') then
    raise exception 'Tax review permission required to approve workpaper';
  end if;

  insert into public.tax_workpapers(
    org_id, return_id, workpaper_key, workpaper_type, status, data,
    source_total, return_total, evidence_reference, prepared_by, reviewed_by,
    reviewed_at, updated_by
  ) values (
    v_return.org_id, p_return_id, trim(p_workpaper_key), p_workpaper_type, p_status,
    coalesce(p_data,'{}'::jsonb), p_source_total, p_return_total,
    nullif(trim(coalesce(p_evidence_reference,'')),''),
    v_user,
    case when p_status = 'approved' then v_user else null end,
    case when p_status = 'approved' then now() else null end,
    v_user
  )
  on conflict (return_id, workpaper_key) do update set
    workpaper_type = excluded.workpaper_type,
    status = excluded.status,
    data = excluded.data,
    source_total = excluded.source_total,
    return_total = excluded.return_total,
    evidence_reference = excluded.evidence_reference,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning id into v_id;

  return query select w.* from public.tax_workpapers w where w.id = v_id;
end
$$;

create or replace function public.tax_open_diagnostic(
  p_return_id uuid,
  p_diagnostic_code text,
  p_severity text,
  p_blocking boolean,
  p_message text,
  p_source_reference text default null,
  p_form_reference text default null
)
returns setof public.tax_diagnostics
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return public.tax_returns := public.tax_assert_return_mutable(p_return_id, 'tax.prepare');
  v_id uuid;
begin
  if p_severity not in ('info','warning','error','fatal') then raise exception 'Invalid diagnostic severity'; end if;

  insert into public.tax_diagnostics(
    org_id, return_id, diagnostic_code, severity, blocking,
    source_reference, form_reference, message, status
  ) values (
    v_return.org_id, p_return_id, trim(p_diagnostic_code), p_severity, p_blocking,
    nullif(trim(coalesce(p_source_reference,'')),''),
    nullif(trim(coalesce(p_form_reference,'')),''),
    trim(p_message), 'open'
  )
  on conflict (return_id, diagnostic_code, source_reference, form_reference) do update set
    severity = excluded.severity,
    blocking = excluded.blocking,
    message = excluded.message,
    status = 'open',
    resolution_note = null,
    resolved_by = null,
    resolved_at = null
  returning id into v_id;

  return query select d.* from public.tax_diagnostics d where d.id = v_id;
end
$$;

create or replace function public.tax_resolve_diagnostic(
  p_diagnostic_id uuid,
  p_resolution_note text,
  p_accept_override boolean default false
)
returns setof public.tax_diagnostics
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.tax_actor_org();
  v_return_id uuid;
begin
  if v_user is null or v_org is null then raise exception 'Authentication and active organization required'; end if;
  if not public.has_identity_permission(v_org, 'tax.review') then raise exception 'Tax review permission required'; end if;

  select d.return_id into v_return_id
  from public.tax_diagnostics d
  where d.id = p_diagnostic_id and d.org_id = v_org;

  if v_return_id is null then raise exception 'Diagnostic not available'; end if;
  perform public.tax_assert_return_mutable(v_return_id, 'tax.review');

  update public.tax_diagnostics
  set status = case when p_accept_override then 'accepted_override' else 'resolved' end,
      resolution_note = nullif(trim(coalesce(p_resolution_note,'')),''),
      resolved_by = v_user,
      resolved_at = now()
  where id = p_diagnostic_id and org_id = v_org;

  insert into public.tax_audit_events(org_id, return_id, entity_type, entity_id, action, details, actor_user_id)
  values (
    v_org, v_return_id, 'tax_diagnostics', p_diagnostic_id,
    case when p_accept_override then 'diagnostic_override_accepted' else 'diagnostic_resolved' end,
    jsonb_build_object('resolution_note', p_resolution_note), v_user
  );

  return query select d.* from public.tax_diagnostics d where d.id = p_diagnostic_id;
end
$$;

create or replace function public.tax_create_carryforward(
  p_source_return_id uuid,
  p_carryforward_key text,
  p_available_tax_year integer,
  p_value jsonb,
  p_expiration_tax_year integer default null,
  p_jurisdiction text default 'US-FED',
  p_rule_pack_version text default null
)
returns setof public.tax_carryforwards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_return public.tax_returns := public.tax_assert_return_mutable(p_source_return_id, 'tax.review');
  v_id uuid;
begin
  if p_available_tax_year < v_return.tax_year then raise exception 'Carryforward available year cannot precede source year'; end if;
  if p_expiration_tax_year is not null and p_expiration_tax_year < p_available_tax_year then raise exception 'Invalid carryforward expiration'; end if;

  insert into public.tax_carryforwards(
    org_id, client_id, source_return_id, carryforward_key, source_tax_year,
    available_tax_year, expiration_tax_year, jurisdiction, value, status,
    rule_pack_version, created_by
  ) values (
    v_return.org_id, v_return.client_id, p_source_return_id, trim(p_carryforward_key),
    v_return.tax_year, p_available_tax_year, p_expiration_tax_year,
    trim(p_jurisdiction), p_value, 'available',
    nullif(trim(coalesce(p_rule_pack_version,'')),''), v_user
  )
  on conflict (client_id, carryforward_key, source_tax_year, jurisdiction, source_return_id) do update set
    available_tax_year = excluded.available_tax_year,
    expiration_tax_year = excluded.expiration_tax_year,
    value = excluded.value,
    status = 'available',
    rule_pack_version = excluded.rule_pack_version,
    updated_at = now()
  returning id into v_id;

  return query select c.* from public.tax_carryforwards c where c.id = v_id;
end
$$;

create or replace function public.tax_lock_return_snapshot(
  p_return_id uuid,
  p_snapshot_kind text,
  p_snapshot jsonb,
  p_authorization_reference text default null,
  p_provider_reference text default null
)
returns setof public.tax_return_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.tax_actor_org();
  v_return public.tax_returns;
  v_hash text;
  v_id uuid;
begin
  if p_snapshot_kind not in ('reviewed','signature','submission','accepted','amended_origin') then
    raise exception 'Invalid snapshot kind';
  end if;
  if p_snapshot is null or p_snapshot = '{}'::jsonb then raise exception 'Return snapshot required'; end if;

  if p_snapshot_kind = 'accepted' then
    if v_user is null or v_org is null then raise exception 'Authentication and active organization required'; end if;
    if not public.has_identity_permission(v_org, 'tax.file') then raise exception 'Tax file permission required'; end if;
    select * into v_return from public.tax_returns r where r.id = p_return_id and r.org_id = v_org;
    if v_return.id is null then raise exception 'Tax return not available in active organization'; end if;
    if v_return.locked_at is null then raise exception 'Accepted snapshot requires a previously locked submission revision'; end if;
  else
    v_return := public.tax_assert_return_mutable(p_return_id, 'tax.review');
  end if;

  if exists (
    select 1 from public.tax_diagnostics d
    where d.return_id = p_return_id and d.org_id = v_return.org_id
      and d.status = 'open' and d.blocking
  ) then raise exception 'Blocking diagnostics must be resolved before snapshot lock'; end if;

  if p_snapshot_kind in ('signature','submission','accepted') and not exists (
    select 1 from public.tax_return_steps s
    where s.return_id = p_return_id and s.step_id = 'professional-review' and s.state = 'complete'
  ) then raise exception 'Professional review must be complete'; end if;

  if p_snapshot_kind in ('submission','accepted') and not exists (
    select 1 from public.tax_return_steps s
    where s.return_id = p_return_id and s.step_id = 'client-review' and s.state = 'complete'
  ) then raise exception 'Client authorization/signature step must be complete'; end if;

  if p_snapshot_kind in ('submission','accepted')
     and length(trim(coalesce(p_authorization_reference,''))) = 0 then
    raise exception 'Authorization reference required for submission snapshot';
  end if;

  v_hash := encode(digest(convert_to(p_snapshot::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.tax_return_snapshots(
    org_id, return_id, snapshot_kind, return_revision, snapshot,
    snapshot_hash, authorization_reference, provider_reference, created_by
  ) values (
    v_return.org_id, p_return_id, p_snapshot_kind, v_return.revision, p_snapshot,
    v_hash, nullif(trim(coalesce(p_authorization_reference,'')),''),
    nullif(trim(coalesce(p_provider_reference,'')),''), v_user
  ) returning id into v_id;

  if p_snapshot_kind = 'submission' then
    update public.tax_returns
    set status = 'ready_to_file', locked_at = now(), updated_by = v_user, updated_at = now()
    where id = p_return_id and org_id = v_return.org_id;
  end if;

  insert into public.tax_audit_events(org_id, return_id, entity_type, entity_id, action, details, actor_user_id)
  values (
    v_return.org_id, p_return_id, 'tax_return_snapshots', v_id, 'snapshot_locked',
    jsonb_build_object('snapshot_kind', p_snapshot_kind, 'snapshot_hash', v_hash), v_user
  );

  return query select s.* from public.tax_return_snapshots s where s.id = v_id;
end
$$;

create or replace function public.tax_prevent_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Tax return snapshots are immutable';
end
$$;

drop trigger if exists tax_snapshots_immutable on public.tax_return_snapshots;
create trigger tax_snapshots_immutable
before update or delete on public.tax_return_snapshots
for each row execute function public.tax_prevent_snapshot_mutation();

create or replace function public.tax_prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Tax audit events are immutable';
end
$$;

drop trigger if exists tax_audit_immutable on public.tax_audit_events;
create trigger tax_audit_immutable
before update or delete on public.tax_audit_events
for each row execute function public.tax_prevent_audit_mutation();

revoke all on function public.tax_create_return(uuid,uuid,uuid,integer,text,text) from public;
revoke all on function public.tax_set_step_state(uuid,text,text,text) from public;
revoke all on function public.tax_register_source_document(uuid,text,integer,text,text,text,jsonb) from public;
revoke all on function public.tax_record_fact(uuid,text,jsonb,text,text,text,uuid,text,text,text,text,text) from public;
revoke all on function public.tax_import_source_mapping(uuid,text,integer,jsonb,text,text,text,jsonb) from public;
revoke all on function public.tax_record_line_mapping(uuid,uuid,text,text,text,text,text,jsonb,text,text,boolean) from public;
revoke all on function public.tax_upsert_workpaper(uuid,text,text,text,jsonb,numeric,numeric,text) from public;
revoke all on function public.tax_open_diagnostic(uuid,text,text,boolean,text,text,text) from public;
revoke all on function public.tax_resolve_diagnostic(uuid,text,boolean) from public;
revoke all on function public.tax_create_carryforward(uuid,text,integer,jsonb,integer,text,text) from public;
revoke all on function public.tax_lock_return_snapshot(uuid,text,jsonb,text,text) from public;

grant execute on function public.tax_create_return(uuid,uuid,uuid,integer,text,text) to authenticated;
grant execute on function public.tax_set_step_state(uuid,text,text,text) to authenticated;
grant execute on function public.tax_register_source_document(uuid,text,integer,text,text,text,jsonb) to authenticated;
grant execute on function public.tax_record_fact(uuid,text,jsonb,text,text,text,uuid,text,text,text,text,text) to authenticated;
grant execute on function public.tax_import_source_mapping(uuid,text,integer,jsonb,text,text,text,jsonb) to authenticated;
grant execute on function public.tax_record_line_mapping(uuid,uuid,text,text,text,text,text,jsonb,text,text,boolean) to authenticated;
grant execute on function public.tax_upsert_workpaper(uuid,text,text,text,jsonb,numeric,numeric,text) to authenticated;
grant execute on function public.tax_open_diagnostic(uuid,text,text,boolean,text,text,text) to authenticated;
grant execute on function public.tax_resolve_diagnostic(uuid,text,boolean) to authenticated;
grant execute on function public.tax_create_carryforward(uuid,text,integer,jsonb,integer,text,text) to authenticated;
grant execute on function public.tax_lock_return_snapshot(uuid,text,jsonb,text,text) to authenticated;

comment on table public.tax_returns is 'Durable ATLAS Tax return work queue and lifecycle. Transmitted/accepted/archived returns are immutable through RPC guards.';
comment on table public.tax_facts is 'Versioned normalized Tax Fact Ledger. New values create a new current version instead of overwriting provenance.';
comment on table public.tax_line_mappings is 'Many-to-many tax fact to form/line provenance graph.';
comment on table public.tax_workpapers is 'Professional tax worksheets, reconciliations, basis, depreciation and book-to-tax workpapers.';
comment on table public.tax_carryforwards is 'Multi-year tax attributes that can be consumed by future returns only under versioned tax rules.';
comment on table public.tax_return_snapshots is 'Immutable reviewed/signature/submission/accepted return snapshots. This table does not itself transmit a return.';

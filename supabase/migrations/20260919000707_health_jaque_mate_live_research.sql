-- ATLAS Health — Jaque Mate live research cycle.
-- Real-source ingestion remains research-only and cannot authorize clinical action.

create table if not exists public.health_research_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'RUNNING' check (status in ('RUNNING','SUCCEEDED','FAILED')),
  sources_seen integer not null default 0 check (sources_seen >= 0),
  sources_upserted integer not null default 0 check (sources_upserted >= 0),
  candidates_created integer not null default 0 check (candidates_created >= 0),
  error_code text
);

create table if not exists public.health_research_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  disease_key text not null check (length(trim(disease_key)) > 0),
  source_name text not null check (source_name in ('EUROPE_PMC','CLINICALTRIALS_GOV')),
  source_identifier text not null check (length(trim(source_identifier)) > 0),
  title text not null check (length(trim(title)) > 0),
  source_url text not null check (source_url ~ '^https://'),
  publication_date date,
  source_updated_at timestamptz,
  evidence_level text not null check (evidence_level in ('human','preclinical','mechanistic','hypothesis')),
  study_status text,
  has_results boolean not null default false,
  curative_signal boolean not null default false,
  contradictory_signal boolean not null default false,
  signal_terms text[] not null default '{}'::text[],
  summary text not null default '',
  limitations jsonb not null default '[]'::jsonb check (jsonb_typeof(limitations) = 'array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (org_id, disease_key, source_name, source_identifier)
);

create table if not exists public.health_research_assessments (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.health_research_runs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  disease_key text not null,
  support_count integer not null default 0,
  contradiction_count integer not null default 0,
  human_support_count integer not null default 0,
  source_family_count integer not null default 0,
  result_bearing_count integer not null default 0,
  candidate_score numeric(5,2) not null default 0 check (candidate_score between 0 and 100),
  classification text not null check (classification in ('INSUFFICIENT','CONTRADICTED','HUMAN_REVIEW_ELIGIBLE')),
  rationale text not null,
  created_at timestamptz not null default now(),
  unique (run_id, disease_key)
);

alter table public.health_cure_candidates
  add column if not exists evidence_snapshot jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_snapshot) = 'array'),
  add column if not exists limitations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(limitations) = 'array'),
  add column if not exists validation_status text not null default 'RESEARCH_ONLY'
    check (validation_status in ('RESEARCH_ONLY','HUMAN_REVIEW_PENDING','EXTERNAL_VALIDATION_PENDING','CONTRADICTED_OR_UNCERTAIN')),
  add column if not exists last_evaluated_at timestamptz;

create index if not exists health_research_runs_org_started_idx
  on public.health_research_runs (org_id, started_at desc);
create index if not exists health_research_sources_org_disease_idx
  on public.health_research_sources (org_id, disease_key, last_seen_at desc);
create index if not exists health_research_sources_signal_idx
  on public.health_research_sources (org_id, disease_key, curative_signal, contradictory_signal);
create index if not exists health_research_assessments_org_created_idx
  on public.health_research_assessments (org_id, created_at desc);

alter table public.health_research_runs enable row level security;
alter table public.health_research_sources enable row level security;
alter table public.health_research_assessments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['health_research_runs','health_research_sources','health_research_assessments']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_authorized_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (
        exists (
          select 1 from public.organization_members om
          where om.org_id = %I.org_id
            and om.user_id = (select auth.uid())
            and om.status = ''active''
        )
        and (
          public.has_identity_permission(%I.org_id, ''atlas.jm.sentinel.read'')
          or public.has_identity_permission(%I.org_id, ''atlas.jm.sentinel.audit'')
        )
      )',
      t || '_authorized_read', t, t, t, t
    );
  end loop;
end
$$;

revoke all on public.health_research_runs from anon, authenticated;
revoke all on public.health_research_sources from anon, authenticated;
revoke all on public.health_research_assessments from anon, authenticated;
grant select on public.health_research_runs to authenticated;
grant select on public.health_research_sources to authenticated;
grant select on public.health_research_assessments to authenticated;
grant all on public.health_research_runs to service_role;
grant all on public.health_research_sources to service_role;
grant all on public.health_research_assessments to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'atlas_jaque_mate_research_trigger_v1') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'atlas_jaque_mate_research_trigger_v1',
      'ATLAS Health Jaque Mate internal scheduled research trigger'
    );
  end if;
end
$$;

create or replace function public.validate_jaque_mate_research_trigger(p_token text)
returns boolean
language sql
security definer
set search_path = public, vault, extensions, pg_catalog
as $$
  select coalesce(
    extensions.digest(convert_to(coalesce(p_token,''), 'UTF8'), 'sha256') =
    extensions.digest(
      convert_to(coalesce((
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'atlas_jaque_mate_research_trigger_v1'
        limit 1
      ), ''), 'UTF8'),
      'sha256'
    ),
    false
  );
$$;

revoke all on function public.validate_jaque_mate_research_trigger(text) from public, anon, authenticated;
grant execute on function public.validate_jaque_mate_research_trigger(text) to service_role;

select cron.schedule(
  'atlas-jaque-mate-live-research-v1',
  '17 */6 * * *',
  $cron$
  select net.http_post(
    url := 'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-health-jaque-mate-research',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-atlas-research-token', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'atlas_jaque_mate_research_trigger_v1'
        limit 1
      )
    ),
    body := jsonb_build_object('mode','scheduled','organization_name','ATLAS'),
    timeout_milliseconds := 120000
  ) as request_id;
  $cron$
);

comment on table public.health_research_sources is
  'Real public biomedical-source metadata gathered by Jaque Mate. Records remain research evidence and are never clinical instructions.';
comment on table public.health_research_assessments is
  'Deterministic Jaque Mate support/contradiction assessments. HUMAN_REVIEW_ELIGIBLE is not a confirmed cure.';

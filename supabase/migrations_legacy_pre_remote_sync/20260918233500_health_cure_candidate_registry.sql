-- ATLAS Health — Jaque Mate possible-cure candidate registry.
-- A Jaque Mate result may be integrated automatically as a governed research candidate.
-- No row in this table is a confirmed cure and no row authorizes clinical action.

create table if not exists public.health_cure_candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  candidate_key text not null check (length(trim(candidate_key)) > 0),
  disease_key text not null check (length(trim(disease_key)) > 0),
  title text not null check (length(trim(title)) > 0),
  research_summary text not null check (length(trim(research_summary)) > 0),
  source_reference text not null check (length(trim(source_reference)) > 0),
  source_evidence_type text not null check (source_evidence_type in ('VALIDATED', 'HYPOTHESIS', 'SIMULATION')),
  research_label text not null default 'POSSIBLE CURE — RESEARCH CANDIDATE'
    check (research_label = 'POSSIBLE CURE — RESEARCH CANDIDATE'),
  stage text not null default 'RESEARCH_CANDIDATE'
    check (stage in (
      'RESEARCH_CANDIDATE',
      'HUMAN_REVIEW_REQUIRED',
      'EXTERNAL_VALIDATION_REQUIRED',
      'REJECTED',
      'ARCHIVED'
    )),
  target_curability_level text not null default 'C5'
    check (target_curability_level = 'C5'),
  clinical_action_allowed boolean not null default false
    check (clinical_action_allowed = false),
  confirmed_cure boolean not null default false
    check (confirmed_cure = false),
  external_validation_required boolean not null default true
    check (external_validation_required = true),
  created_by_service text not null check (length(trim(created_by_service)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, candidate_key)
);

create index if not exists health_cure_candidates_org_stage_created_idx
  on public.health_cure_candidates (org_id, stage, created_at desc);

alter table public.health_cure_candidates enable row level security;

drop policy if exists health_cure_candidates_authorized_read
  on public.health_cure_candidates;
create policy health_cure_candidates_authorized_read
  on public.health_cure_candidates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.org_id = health_cure_candidates.org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
    and (
      public.has_identity_permission(health_cure_candidates.org_id, 'atlas.jm.sentinel.read')
      or public.has_identity_permission(health_cure_candidates.org_id, 'atlas.jm.sentinel.audit')
    )
  );

revoke all on public.health_cure_candidates from anon, authenticated;
grant select on public.health_cure_candidates to authenticated;
grant all on public.health_cure_candidates to service_role;

comment on table public.health_cure_candidates is
  'ATLAS Health Jaque Mate possible-cure research candidates. Service-controlled ingestion only. Candidate status is not confirmation of cure and never authorizes clinical action.';

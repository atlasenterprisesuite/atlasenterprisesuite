create table if not exists public.decision_compass_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  signal_kind text not null check (signal_kind in ('symbolic', 'intuition', 'observation', 'user-note', 'ai-reflection')),
  signal_label text not null,
  signal_text text not null,
  interpretation text not null,
  target_module text,
  risk text not null check (risk in ('low', 'medium', 'high', 'critical')),
  proposed_action text,
  verification_gate jsonb not null default '[]'::jsonb check (jsonb_typeof(verification_gate) = 'array'),
  truth_state text not null default 'reflection' check (truth_state in ('reflection', 'needs_evidence', 'evidence_found', 'action_proposed', 'blocked', 'verified', 'rejected', 'superseded')),
  verified_by uuid,
  verified_at timestamptz,
  unique (id, org_id)
);

create table if not exists public.decision_compass_evidence_refs (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_module text not null,
  source_kind text not null,
  source_id text not null,
  label text not null,
  verified_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (record_id, org_id)
    references public.decision_compass_records(id, org_id)
    on delete cascade
);

create table if not exists public.decision_compass_audit (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  previous_state text not null,
  next_state text not null,
  actor_id uuid not null,
  reason text not null,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (record_id, org_id)
    references public.decision_compass_records(id, org_id)
    on delete cascade
);

create index if not exists decision_compass_records_org_created_idx
  on public.decision_compass_records (org_id, created_at desc);
create index if not exists decision_compass_evidence_record_idx
  on public.decision_compass_evidence_refs (org_id, record_id, created_at desc);
create index if not exists decision_compass_audit_record_idx
  on public.decision_compass_audit (org_id, record_id, created_at desc);

alter table public.decision_compass_records enable row level security;
alter table public.decision_compass_evidence_refs enable row level security;
alter table public.decision_compass_audit enable row level security;

revoke all on public.decision_compass_records from anon;
revoke all on public.decision_compass_evidence_refs from anon;
revoke all on public.decision_compass_audit from anon;
revoke all on public.decision_compass_records from authenticated;
revoke all on public.decision_compass_evidence_refs from authenticated;
revoke all on public.decision_compass_audit from authenticated;

grant select, insert on public.decision_compass_records to authenticated;
grant select, insert on public.decision_compass_evidence_refs to authenticated;
grant select on public.decision_compass_audit to authenticated;

drop policy if exists decision_compass_records_read on public.decision_compass_records;
create policy decision_compass_records_read
  on public.decision_compass_records
  for select
  to authenticated
  using (public.is_org_member(org_id));

drop policy if exists decision_compass_records_insert on public.decision_compass_records;
create policy decision_compass_records_insert
  on public.decision_compass_records
  for insert
  to authenticated
  with check (
    public.is_org_member(org_id)
    and created_by = auth.uid()
    and truth_state = 'reflection'
    and verified_by is null
    and verified_at is null
  );

drop policy if exists decision_compass_evidence_read on public.decision_compass_evidence_refs;
create policy decision_compass_evidence_read
  on public.decision_compass_evidence_refs
  for select
  to authenticated
  using (public.is_org_member(org_id));

drop policy if exists decision_compass_evidence_insert on public.decision_compass_evidence_refs;
create policy decision_compass_evidence_insert
  on public.decision_compass_evidence_refs
  for insert
  to authenticated
  with check (
    public.is_org_member(org_id)
    and created_by = auth.uid()
    and exists (
      select 1
      from public.decision_compass_records r
      where r.id = record_id
        and r.org_id = org_id
        and public.is_org_member(r.org_id)
    )
  );

drop policy if exists decision_compass_audit_read on public.decision_compass_audit;
create policy decision_compass_audit_read
  on public.decision_compass_audit
  for select
  to authenticated
  using (public.is_org_member(org_id));

create or replace function public.decision_compass_transition(
  p_record_id uuid,
  p_next_state text,
  p_reason text default null
)
returns public.decision_compass_records
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_record public.decision_compass_records%rowtype;
  updated_record public.decision_compass_records%rowtype;
  transition_allowed boolean := false;
  evidence_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select *
    into current_record
    from public.decision_compass_records
    where id = p_record_id
    for update;

  if not found then
    raise exception 'decision_record_not_found';
  end if;

  if not public.is_org_member(current_record.org_id) then
    raise exception 'decision_scope_mismatch';
  end if;

  transition_allowed := case current_record.truth_state
    when 'reflection' then p_next_state in ('needs_evidence', 'blocked', 'rejected', 'superseded')
    when 'needs_evidence' then p_next_state in ('evidence_found', 'blocked', 'rejected', 'superseded')
    when 'evidence_found' then p_next_state in ('needs_evidence', 'action_proposed', 'blocked', 'rejected', 'superseded')
    when 'action_proposed' then p_next_state in ('evidence_found', 'blocked', 'verified', 'rejected', 'superseded')
    when 'blocked' then p_next_state in ('needs_evidence', 'evidence_found', 'action_proposed', 'rejected', 'superseded')
    when 'verified' then p_next_state in ('superseded')
    when 'rejected' then p_next_state in ('superseded')
    else false
  end;

  if not transition_allowed then
    raise exception 'invalid_truth_state_transition';
  end if;

  if p_next_state = 'verified' then
    select count(*)
      into evidence_count
      from public.decision_compass_evidence_refs e
      where e.record_id = current_record.id
        and e.org_id = current_record.org_id;

    if evidence_count < 1 then
      raise exception 'verification_requires_independent_evidence';
    end if;

    if jsonb_array_length(coalesce(current_record.verification_gate, '[]'::jsonb)) = 0 then
      raise exception 'verification_gate_incomplete';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(current_record.verification_gate) gate
      where coalesce((gate->>'passed')::boolean, false) is not true
    ) then
      raise exception 'verification_gate_incomplete';
    end if;
  end if;

  update public.decision_compass_records
    set truth_state = p_next_state,
        verified_by = case when p_next_state = 'verified' then auth.uid() else verified_by end,
        verified_at = case when p_next_state = 'verified' then now() else verified_at end
    where id = current_record.id
    returning * into updated_record;

  insert into public.decision_compass_audit (
    record_id,
    org_id,
    previous_state,
    next_state,
    actor_id,
    reason,
    evidence_snapshot
  ) values (
    current_record.id,
    current_record.org_id,
    current_record.truth_state,
    p_next_state,
    auth.uid(),
    coalesce(nullif(trim(p_reason), ''), 'state_transition'),
    jsonb_build_object(
      'evidence_count', evidence_count,
      'verification_gate', current_record.verification_gate
    )
  );

  return updated_record;
end;
$$;

revoke all on function public.decision_compass_transition(uuid, text, text) from public;
grant execute on function public.decision_compass_transition(uuid, text, text) to authenticated;

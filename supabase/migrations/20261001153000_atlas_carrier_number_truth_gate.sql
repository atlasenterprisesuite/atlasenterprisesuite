-- ATLAS Carrier numbering lifecycle enforcement.
-- Fail closed: inventory discovery is never ownership; ACTIVE requires authenticated allocation evidence.

alter table public.atlas_number_resources
  drop constraint if exists atlas_number_resources_state_check;

alter table public.atlas_number_resources
  add constraint atlas_number_resources_state_check
  check (state in (
    'unavailable',
    'discovered',
    'reserved',
    'ordered',
    'allocated',
    'verified',
    'assigned',
    'active',
    'suspended',
    'released'
  ));

create or replace function public.atlas_enforce_number_resource_truth()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  authorization_state text;
  evidence_provider_id text;
  evidence_observed_at text;
  evidence_method text;
  evidence_digest text;
begin
  -- A discovered number is only inventory. It must not carry ownership proof.
  if new.state = 'discovered' then
    new.verified_at := null;
  end if;

  -- Allocation and every stronger positive state require authenticated upstream identity/evidence.
  if new.state in ('allocated','verified','assigned','active') then
    if nullif(btrim(coalesce(new.upstream_provider, '')), '') is null
       or nullif(btrim(coalesce(new.external_resource_id, '')), '') is null then
      raise exception 'atlas_number_allocation_evidence_required';
    end if;

    evidence_provider_id := nullif(btrim(coalesce(new.provider_evidence->>'provider_resource_id', '')), '');
    evidence_observed_at := nullif(btrim(coalesce(new.provider_evidence->>'observed_at', '')), '');
    evidence_method := nullif(btrim(coalesce(new.provider_evidence->>'verification_method', '')), '');
    evidence_digest := nullif(btrim(coalesce(new.provider_evidence->>'evidence_digest', '')), '');

    if evidence_provider_id is null
       or evidence_observed_at is null
       or evidence_method is null
       or evidence_digest is null then
      raise exception 'atlas_number_authenticated_evidence_incomplete';
    end if;

    if evidence_provider_id <> new.external_resource_id then
      raise exception 'atlas_number_evidence_resource_mismatch';
    end if;

    if new.authorization_id is null then
      raise exception 'atlas_number_authorization_required';
    end if;

    select state into authorization_state
      from public.atlas_numbering_authorizations
     where id = new.authorization_id
       and organization_id = new.organization_id;

    if authorization_state is null
       or authorization_state in ('not_started','fcc_application_pending','suspended','revoked') then
      raise exception 'atlas_number_authorization_not_ready';
    end if;
  end if;

  -- VERIFIED and stronger states require an explicit server verification timestamp.
  if new.state in ('verified','assigned','active') and new.verified_at is null then
    raise exception 'atlas_number_server_verification_required';
  end if;

  -- ACTIVE is a service claim, so it additionally requires a bound service.
  if new.state = 'active' and new.assigned_service is null then
    raise exception 'atlas_number_active_service_required';
  end if;

  -- Prevent positive lifecycle rollback. Suspension/release remain allowed safety transitions.
  if tg_op = 'UPDATE'
     and old.state in ('allocated','verified','assigned','active')
     and new.state in ('discovered','reserved','ordered') then
    raise exception 'atlas_number_lifecycle_rollback_blocked';
  end if;

  return new;
end;
$$;

drop trigger if exists atlas_number_resource_truth_guard
  on public.atlas_number_resources;

create trigger atlas_number_resource_truth_guard
before insert or update on public.atlas_number_resources
for each row execute function public.atlas_enforce_number_resource_truth();

comment on function public.atlas_enforce_number_resource_truth() is
  'Fail-closed carrier numbering truth gate. Positive ownership/service states require authorization plus authenticated upstream allocation evidence.';

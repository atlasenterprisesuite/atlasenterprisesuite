-- ATLAS Health — Jaque Mate + Sentinel database hardening.
-- Preserves atlas.jm.sentinel.read / atlas.jm.sentinel.write / atlas.jm.sentinel.audit semantics.
-- Educational simulations retain the immutable watermark: SIMULATION — NOT CLINICAL EVIDENCE.

create index if not exists health_evidence_hypotheses_created_by_idx
  on public.health_evidence_hypotheses (created_by);
create index if not exists health_evidence_simulation_created_by_idx
  on public.health_evidence_simulation (created_by);
create index if not exists health_sentinel_config_updated_by_idx
  on public.health_sentinel_config (updated_by);

drop policy if exists health_evidence_validated_authorized_read
  on public.health_evidence_validated;
create policy health_evidence_validated_authorized_read
  on public.health_evidence_validated
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.org_id = health_evidence_validated.org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
    and (
      public.has_identity_permission(health_evidence_validated.org_id, 'atlas.jm.sentinel.read')
      or public.has_identity_permission(health_evidence_validated.org_id, 'atlas.jm.sentinel.audit')
    )
  );

drop policy if exists health_evidence_hypotheses_authorized_read
  on public.health_evidence_hypotheses;
create policy health_evidence_hypotheses_authorized_read
  on public.health_evidence_hypotheses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.org_id = health_evidence_hypotheses.org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
    and (
      public.has_identity_permission(health_evidence_hypotheses.org_id, 'atlas.jm.sentinel.read')
      or public.has_identity_permission(health_evidence_hypotheses.org_id, 'atlas.jm.sentinel.audit')
    )
  );

drop policy if exists health_evidence_hypotheses_authorized_insert
  on public.health_evidence_hypotheses;
create policy health_evidence_hypotheses_authorized_insert
  on public.health_evidence_hypotheses
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.organization_members om
      where om.org_id = health_evidence_hypotheses.org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
    and public.has_identity_permission(health_evidence_hypotheses.org_id, 'atlas.jm.sentinel.write')
  );

drop policy if exists health_evidence_simulation_authorized_read
  on public.health_evidence_simulation;
create policy health_evidence_simulation_authorized_read
  on public.health_evidence_simulation
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.org_id = health_evidence_simulation.org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
    and (
      public.has_identity_permission(health_evidence_simulation.org_id, 'atlas.jm.sentinel.read')
      or public.has_identity_permission(health_evidence_simulation.org_id, 'atlas.jm.sentinel.audit')
    )
  );

drop policy if exists health_evidence_simulation_authorized_insert
  on public.health_evidence_simulation;
create policy health_evidence_simulation_authorized_insert
  on public.health_evidence_simulation
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and watermark = 'SIMULATION — NOT CLINICAL EVIDENCE'
    and exists (
      select 1
      from public.organization_members om
      where om.org_id = health_evidence_simulation.org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
    and public.has_identity_permission(health_evidence_simulation.org_id, 'atlas.jm.sentinel.write')
  );

drop policy if exists health_sentinel_config_authorized_read
  on public.health_sentinel_config;
create policy health_sentinel_config_authorized_read
  on public.health_sentinel_config
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.org_id = health_sentinel_config.org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
    and (
      public.has_identity_permission(health_sentinel_config.org_id, 'atlas.jm.sentinel.read')
      or public.has_identity_permission(health_sentinel_config.org_id, 'atlas.jm.sentinel.audit')
    )
  );

drop policy if exists health_sentinel_config_authorized_insert
  on public.health_sentinel_config;
create policy health_sentinel_config_authorized_insert
  on public.health_sentinel_config
  for insert
  to authenticated
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1
      from public.organization_members om
      where om.org_id = health_sentinel_config.org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
    and public.has_identity_permission(health_sentinel_config.org_id, 'atlas.jm.sentinel.write')
  );

drop policy if exists health_sentinel_config_authorized_update
  on public.health_sentinel_config;
create policy health_sentinel_config_authorized_update
  on public.health_sentinel_config
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.org_id = health_sentinel_config.org_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
    and public.has_identity_permission(health_sentinel_config.org_id, 'atlas.jm.sentinel.write')
  )
  with check (
    updated_by = (select auth.uid())
    and public.has_identity_permission(health_sentinel_config.org_id, 'atlas.jm.sentinel.write')
  );

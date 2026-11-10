-- ATLAS Urban Twin Core FK index hardening.
-- Cover foreign keys using the exact leading-column order expected by Postgres advisors.

create index if not exists atlas_urban_twin_entities_tenant_idx
  on public.atlas_urban_twin_entities(tenant_id);
create index if not exists atlas_urban_twin_entities_parent_scope_idx
  on public.atlas_urban_twin_entities(parent_id, org_id)
  where parent_id is not null;
create index if not exists atlas_urban_twin_entities_created_by_idx
  on public.atlas_urban_twin_entities(created_by)
  where created_by is not null;

create index if not exists atlas_urban_twin_bindings_tenant_idx
  on public.atlas_urban_twin_bindings(tenant_id);
create index if not exists atlas_urban_twin_bindings_entity_scope_idx
  on public.atlas_urban_twin_bindings(entity_id, org_id);
create index if not exists atlas_urban_twin_bindings_created_by_idx
  on public.atlas_urban_twin_bindings(created_by)
  where created_by is not null;

create index if not exists atlas_urban_twin_observations_tenant_idx
  on public.atlas_urban_twin_observations(tenant_id);
create index if not exists atlas_urban_twin_observations_entity_scope_idx
  on public.atlas_urban_twin_observations(entity_id, org_id);
create index if not exists atlas_urban_twin_observations_binding_scope_idx
  on public.atlas_urban_twin_observations(binding_id, org_id)
  where binding_id is not null;

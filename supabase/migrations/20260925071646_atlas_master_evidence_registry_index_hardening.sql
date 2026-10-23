-- ATLAS Master Evidence Registry v1 performance hardening
-- Adds covering indexes for foreign keys reported by Supabase advisors.

create index if not exists idx_atlas_master_evidence_deployment
  on public.atlas_master_evidence_registry(deployment_id)
  where deployment_id is not null;

create index if not exists idx_atlas_master_evidence_created_by
  on public.atlas_master_evidence_registry(created_by)
  where created_by is not null;

comment on index public.idx_atlas_master_evidence_deployment is
'Covering index for atlas_master_evidence_registry.deployment_id foreign key.';

comment on index public.idx_atlas_master_evidence_created_by is
'Covering index for atlas_master_evidence_registry.created_by foreign key.';

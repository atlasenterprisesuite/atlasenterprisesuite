alter table public.atlas_workflows
  add column if not exists evidence_ids uuid[] not null default '{}'::uuid[];

create index if not exists atlas_workflows_evidence_ids_gin_idx
  on public.atlas_workflows using gin (evidence_ids);

comment on column public.atlas_workflows.evidence_ids is
  'Verified evidence references associated with workflow completion; raw evidence payloads are not stored here.';

drop index if exists public.atlas_conversation_executions_work_unit_fk_idx;
create index atlas_conversation_executions_work_unit_fk_idx
  on public.atlas_conversation_executions (org_id, project_id, work_unit_id);

drop index if exists public.atlas_work_units_parent_fk_idx;
create index atlas_work_units_parent_fk_idx
  on public.atlas_work_units (org_id, project_id, parent_work_unit_id);

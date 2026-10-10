-- ATLAS Work Graph performance hardening
-- Cover tenant-scoped and user foreign keys reported by the database advisor.
begin;

create index if not exists atlas_conversation_executions_project_fk_idx
  on public.atlas_conversation_executions(org_id, project_id);
create index if not exists atlas_conversation_executions_work_unit_fk_idx
  on public.atlas_conversation_executions(org_id, work_unit_id);
create index if not exists atlas_work_projects_owner_user_id_idx
  on public.atlas_work_projects(owner_user_id);
create index if not exists atlas_work_units_assigned_user_id_idx
  on public.atlas_work_units(assigned_user_id);
create index if not exists atlas_work_units_parent_fk_idx
  on public.atlas_work_units(org_id, parent_work_unit_id);

commit;

-- ATLAS Work Graph referential hardening
-- Preserve Conversation-to-Execution traceability by requiring graph records
-- to be archived instead of silently nulling tenant-scoped composite links.
begin;

alter table public.atlas_conversation_executions
  drop constraint if exists atlas_conversation_executions_project_fk;
alter table public.atlas_conversation_executions
  add constraint atlas_conversation_executions_project_fk
  foreign key (org_id, project_id)
  references public.atlas_work_projects(org_id, id)
  on delete restrict;

alter table public.atlas_conversation_executions
  drop constraint if exists atlas_conversation_executions_work_unit_fk;
alter table public.atlas_conversation_executions
  add constraint atlas_conversation_executions_work_unit_fk
  foreign key (org_id, work_unit_id)
  references public.atlas_work_units(org_id, id)
  on delete restrict;

commit;

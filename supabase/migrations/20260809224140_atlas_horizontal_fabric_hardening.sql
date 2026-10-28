begin;

create index if not exists atlas_module_records_created_by_idx on public.atlas_module_records(created_by);
create index if not exists atlas_module_records_updated_by_idx on public.atlas_module_records(updated_by);
create index if not exists atlas_events_actor_id_idx on public.atlas_events(actor_id);
create index if not exists atlas_workflows_created_by_idx on public.atlas_workflows(created_by);
create index if not exists atlas_workflows_updated_by_idx on public.atlas_workflows(updated_by);
create index if not exists atlas_workflow_runs_workflow_id_idx on public.atlas_workflow_runs(workflow_id);
create index if not exists atlas_workflow_runs_event_id_idx on public.atlas_workflow_runs(event_id);
create index if not exists atlas_workflow_runs_actor_id_idx on public.atlas_workflow_runs(actor_id);
create index if not exists atlas_connectors_created_by_idx on public.atlas_connectors(created_by);
create index if not exists atlas_connectors_updated_by_idx on public.atlas_connectors(updated_by);
create index if not exists atlas_outbox_org_id_idx on public.atlas_outbox(org_id);
create index if not exists atlas_outbox_event_id_idx on public.atlas_outbox(event_id);
create index if not exists atlas_outbox_created_by_idx on public.atlas_outbox(created_by);
create index if not exists atlas_intelligence_signals_created_by_idx on public.atlas_intelligence_signals(created_by);
create index if not exists atlas_intelligence_signals_subject_user_id_idx on public.atlas_intelligence_signals(subject_user_id);

-- Replace overlapping FOR ALL policies with operation-specific policies and cache auth.uid() once per statement.
drop policy if exists atlas_module_registry_manage on public.atlas_module_registry;
drop policy if exists atlas_module_registry_insert on public.atlas_module_registry;
drop policy if exists atlas_module_registry_update on public.atlas_module_registry;
drop policy if exists atlas_module_registry_delete on public.atlas_module_registry;
create policy atlas_module_registry_insert on public.atlas_module_registry for insert to authenticated
with check(public.has_org_role(org_id,array['owner','admin']));
create policy atlas_module_registry_update on public.atlas_module_registry for update to authenticated
using(public.has_org_role(org_id,array['owner','admin'])) with check(public.has_org_role(org_id,array['owner','admin']));
create policy atlas_module_registry_delete on public.atlas_module_registry for delete to authenticated
using(public.has_org_role(org_id,array['owner','admin']));

drop policy if exists atlas_module_records_read on public.atlas_module_records;
create policy atlas_module_records_read on public.atlas_module_records for select to authenticated
using(public.is_org_member(org_id) and (module_code not in ('wallet','health','identity') or subject_user_id=(select auth.uid()) or public.has_org_role(org_id,array['owner','admin','manager'])));
drop policy if exists atlas_module_records_insert on public.atlas_module_records;
create policy atlas_module_records_insert on public.atlas_module_records for insert to authenticated
with check(created_by=(select auth.uid()) and updated_by=(select auth.uid()) and ((module_code in ('wallet','health','identity') and (subject_user_id=(select auth.uid()) or public.has_org_role(org_id,array['owner','admin','manager']))) or (module_code not in ('wallet','health','identity') and public.can_write_business_data(org_id))));
drop policy if exists atlas_module_records_update on public.atlas_module_records;
create policy atlas_module_records_update on public.atlas_module_records for update to authenticated
using((module_code in ('wallet','health','identity') and (subject_user_id=(select auth.uid()) or public.has_org_role(org_id,array['owner','admin','manager']))) or (module_code not in ('wallet','health','identity') and public.can_write_business_data(org_id)))
with check(updated_by=(select auth.uid()) and ((module_code in ('wallet','health','identity') and (subject_user_id=(select auth.uid()) or public.has_org_role(org_id,array['owner','admin','manager']))) or (module_code not in ('wallet','health','identity') and public.can_write_business_data(org_id))));

drop policy if exists atlas_events_insert on public.atlas_events;
create policy atlas_events_insert on public.atlas_events for insert to authenticated
with check(public.is_org_member(org_id) and actor_id=(select auth.uid()));

drop policy if exists atlas_workflows_write on public.atlas_workflows;
drop policy if exists atlas_workflows_insert on public.atlas_workflows;
drop policy if exists atlas_workflows_update on public.atlas_workflows;
drop policy if exists atlas_workflows_delete on public.atlas_workflows;
create policy atlas_workflows_insert on public.atlas_workflows for insert to authenticated
with check(public.can_write_business_data(org_id) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy atlas_workflows_update on public.atlas_workflows for update to authenticated
using(public.can_write_business_data(org_id)) with check(public.can_write_business_data(org_id) and updated_by=(select auth.uid()));
create policy atlas_workflows_delete on public.atlas_workflows for delete to authenticated
using(public.has_org_role(org_id,array['owner','admin']));

drop policy if exists atlas_workflow_runs_insert on public.atlas_workflow_runs;
create policy atlas_workflow_runs_insert on public.atlas_workflow_runs for insert to authenticated
with check(public.can_write_business_data(org_id) and actor_id=(select auth.uid()));

drop policy if exists atlas_connectors_manage on public.atlas_connectors;
drop policy if exists atlas_connectors_insert on public.atlas_connectors;
drop policy if exists atlas_connectors_update on public.atlas_connectors;
drop policy if exists atlas_connectors_delete on public.atlas_connectors;
create policy atlas_connectors_insert on public.atlas_connectors for insert to authenticated
with check(public.has_org_role(org_id,array['owner','admin']) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy atlas_connectors_update on public.atlas_connectors for update to authenticated
using(public.has_org_role(org_id,array['owner','admin'])) with check(public.has_org_role(org_id,array['owner','admin']) and updated_by=(select auth.uid()));
create policy atlas_connectors_delete on public.atlas_connectors for delete to authenticated
using(public.has_org_role(org_id,array['owner','admin']));

drop policy if exists atlas_outbox_write on public.atlas_outbox;
drop policy if exists atlas_outbox_insert on public.atlas_outbox;
drop policy if exists atlas_outbox_update on public.atlas_outbox;
drop policy if exists atlas_outbox_delete on public.atlas_outbox;
create policy atlas_outbox_insert on public.atlas_outbox for insert to authenticated
with check(public.has_org_role(org_id,array['owner','admin','manager']) and created_by=(select auth.uid()));
create policy atlas_outbox_update on public.atlas_outbox for update to authenticated
using(public.has_org_role(org_id,array['owner','admin','manager'])) with check(public.has_org_role(org_id,array['owner','admin','manager']));
create policy atlas_outbox_delete on public.atlas_outbox for delete to authenticated
using(public.has_org_role(org_id,array['owner','admin']));

drop policy if exists atlas_intelligence_signals_read on public.atlas_intelligence_signals;
create policy atlas_intelligence_signals_read on public.atlas_intelligence_signals for select to authenticated
using(public.is_org_member(org_id) and (subject_user_id is null or subject_user_id=(select auth.uid()) or public.has_org_role(org_id,array['owner','admin','manager'])));
drop policy if exists atlas_intelligence_signals_insert on public.atlas_intelligence_signals;
create policy atlas_intelligence_signals_insert on public.atlas_intelligence_signals for insert to authenticated
with check(public.can_write_business_data(org_id) and created_by=(select auth.uid()));

commit;

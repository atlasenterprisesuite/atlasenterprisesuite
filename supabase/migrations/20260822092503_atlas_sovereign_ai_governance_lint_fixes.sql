create index if not exists atlas_agent_tool_policies_created_by_idx on public.atlas_agent_tool_policies(created_by);
create index if not exists atlas_agent_tool_policies_updated_by_idx on public.atlas_agent_tool_policies(updated_by);
create index if not exists atlas_ai_budgets_created_by_idx on public.atlas_ai_budgets(created_by);
create index if not exists atlas_ai_budgets_updated_by_idx on public.atlas_ai_budgets(updated_by);
create index if not exists atlas_ai_data_policies_created_by_idx on public.atlas_ai_data_policies(created_by);
create index if not exists atlas_ai_data_policies_updated_by_idx on public.atlas_ai_data_policies(updated_by);
create index if not exists atlas_ai_usage_actor_fk_idx on public.atlas_ai_usage(actor_id);
create index if not exists atlas_eval_cases_created_by_idx on public.atlas_eval_cases(created_by);
create index if not exists atlas_eval_runs_created_by_idx on public.atlas_eval_runs(created_by);
create index if not exists atlas_eval_runs_org_idx on public.atlas_eval_runs(org_id);
create index if not exists atlas_eval_scores_org_idx on public.atlas_eval_scores(org_id);
create index if not exists atlas_eval_suites_created_by_idx on public.atlas_eval_suites(created_by);
create index if not exists atlas_eval_suites_updated_by_idx on public.atlas_eval_suites(updated_by);

drop policy if exists atlas_eval_suites_write on public.atlas_eval_suites;
create policy atlas_eval_suites_insert on public.atlas_eval_suites for insert to authenticated with check (public.has_org_role(org_id,array['owner','admin']) and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy atlas_eval_suites_update on public.atlas_eval_suites for update to authenticated using (public.has_org_role(org_id,array['owner','admin'])) with check (public.has_org_role(org_id,array['owner','admin']) and updated_by=(select auth.uid()));
create policy atlas_eval_suites_delete on public.atlas_eval_suites for delete to authenticated using (public.has_org_role(org_id,array['owner','admin']));

drop policy if exists atlas_eval_cases_write on public.atlas_eval_cases;
create policy atlas_eval_cases_insert on public.atlas_eval_cases for insert to authenticated with check (public.has_org_role(org_id,array['owner','admin']) and created_by=(select auth.uid()));
create policy atlas_eval_cases_update on public.atlas_eval_cases for update to authenticated using (public.has_org_role(org_id,array['owner','admin'])) with check (public.has_org_role(org_id,array['owner','admin']));
create policy atlas_eval_cases_delete on public.atlas_eval_cases for delete to authenticated using (public.has_org_role(org_id,array['owner','admin']));

drop policy if exists atlas_eval_runs_write on public.atlas_eval_runs;
create policy atlas_eval_runs_insert on public.atlas_eval_runs for insert to authenticated with check (public.has_org_role(org_id,array['owner','admin']) and created_by=(select auth.uid()));
create policy atlas_eval_runs_update on public.atlas_eval_runs for update to authenticated using (public.has_org_role(org_id,array['owner','admin'])) with check (public.has_org_role(org_id,array['owner','admin']));
create policy atlas_eval_runs_delete on public.atlas_eval_runs for delete to authenticated using (public.has_org_role(org_id,array['owner','admin']));

drop policy if exists atlas_eval_scores_write on public.atlas_eval_scores;
create policy atlas_eval_scores_insert on public.atlas_eval_scores for insert to authenticated with check (public.has_org_role(org_id,array['owner','admin']));
create policy atlas_eval_scores_update on public.atlas_eval_scores for update to authenticated using (public.has_org_role(org_id,array['owner','admin'])) with check (public.has_org_role(org_id,array['owner','admin']));
create policy atlas_eval_scores_delete on public.atlas_eval_scores for delete to authenticated using (public.has_org_role(org_id,array['owner','admin']));

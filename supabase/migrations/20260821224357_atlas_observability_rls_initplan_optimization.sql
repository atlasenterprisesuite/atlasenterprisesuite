drop policy if exists atlas_trace_spans_insert on public.atlas_trace_spans;
create policy atlas_trace_spans_insert on public.atlas_trace_spans
  for insert to authenticated
  with check (public.is_org_member(org_id) and actor_id = (select auth.uid()));

drop policy if exists atlas_operational_metrics_insert on public.atlas_operational_metrics;
create policy atlas_operational_metrics_insert on public.atlas_operational_metrics
  for insert to authenticated
  with check (public.is_org_member(org_id) and actor_id = (select auth.uid()));

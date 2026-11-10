do $$
declare
  v_def text;
  v_old text := 'and t.tgname=''atlas_audit_incident_transition'' and not t.tgisinternal';
  v_new text := 'and not t.tgisinternal and t.tgenabled<>''D'' and exists (select 1 from pg_proc f where f.oid=t.tgfoid and f.proname=''audit_atlas_incident_change'')';
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='atlas_run_observability_e2e'
  limit 1;
  if v_def is null then raise exception 'atlas_run_observability_e2e_missing'; end if;
  if position(v_old in v_def)=0 then raise exception 'expected_audit_trigger_detection_fragment_missing'; end if;
  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end $$;

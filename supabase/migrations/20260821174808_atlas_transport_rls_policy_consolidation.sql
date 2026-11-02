do $migration$
declare
  t text;
begin
  foreach t in array array['transport_vehicles','transport_drivers','transport_trips']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_org_role(org_id, array[''owner''::text,''admin''::text]))',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_org_role(org_id, array[''owner''::text,''admin''::text])) with check (public.has_org_role(org_id, array[''owner''::text,''admin''::text]))',
      t || '_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_org_role(org_id, array[''owner''::text,''admin''::text]))',
      t || '_delete', t
    );
  end loop;
end;
$migration$;

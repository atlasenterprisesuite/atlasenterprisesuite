do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('education_assessments','can_write_education_data'),
      ('education_courses','can_write_education_data'),
      ('education_credentials','can_write_education_data'),
      ('education_enrollments','can_write_education_data'),
      ('education_learners','can_write_education_data'),
      ('education_results','can_write_education_data'),
      ('purchase_order_lines','can_write_purchasing_data'),
      ('purchase_orders','can_write_purchasing_data'),
      ('purchasing_vendors','can_write_purchasing_data'),
      ('sales_customers','can_write_sales_data'),
      ('sales_order_lines','can_write_sales_data'),
      ('sales_orders','can_write_sales_data')
    ) as v(table_name, helper_name)
  loop
    execute format('drop policy if exists %I on public.%I', r.table_name || '_write', r.table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.%I(org_id))',
      r.table_name || '_write_insert', r.table_name, r.helper_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.%I(org_id)) with check (public.%I(org_id))',
      r.table_name || '_write_update', r.table_name, r.helper_name, r.helper_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.%I(org_id))',
      r.table_name || '_write_delete', r.table_name, r.helper_name
    );
  end loop;
end $$;

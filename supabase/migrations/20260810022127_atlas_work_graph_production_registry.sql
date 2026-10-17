-- ATLAS Work Graph production registry integration
-- Promote the validated graph services into the horizontal production module catalog.
begin;

insert into public.atlas_module_registry(
  org_id, module_code, enabled, launch_status, data_backend, config
)
select
  o.id,
  m.module_code,
  true,
  'active',
  'work_graph',
  m.config
from public.organizations o
cross join (
  values
    ('work_graph'::text, '{"executionModel":"project-work-unit-evidence"}'::jsonb),
    ('conversation_execution'::text, '{"input":"conversation","output":"work_graph"}'::jsonb)
) as m(module_code, config)
on conflict (org_id, module_code)
do update set
  enabled = excluded.enabled,
  launch_status = excluded.launch_status,
  data_backend = excluded.data_backend,
  config = excluded.config,
  updated_at = now();

update public.organization_modules
set enabled = true,
    launch_status = 'active',
    updated_at = now()
where module_code in ('work_graph', 'conversation_execution');

commit;

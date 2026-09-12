create unique index if not exists execution_manager_readiness_one_active_idx
on public.execution_workflows (org_id, workflow_type)
where workflow_type = 'manager.infrastructure_readiness'
  and status not in ('completed','cancelled','discarded');

create index if not exists execution_manager_readiness_updated_idx
on public.execution_workflows (org_id, updated_at desc)
where workflow_type = 'manager.infrastructure_readiness';

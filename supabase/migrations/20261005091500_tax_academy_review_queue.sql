-- ATLAS Tax Academy reviewer-only read surface.
-- Candidate endpoints remain separate; this RPC requires tax.review server-side.

create or replace function public.tax_academy_list_review_queue()
returns table(
  attempt_id uuid,
  org_id uuid,
  user_id uuid,
  case_id text,
  case_version text,
  weighted_score numeric,
  critical_failure_codes text[],
  submitted_at timestamptz,
  evidence_reference_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.tax_actor_org();
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Authentication and active organization required';
  end if;
  if not public.has_identity_permission(v_org, 'tax.review') then
    raise exception 'Tax review permission required';
  end if;

  return query
  select
    a.id,
    a.org_id,
    a.user_id,
    a.case_id,
    a.case_version,
    r.weighted_score,
    coalesce(r.critical_failure_codes, '{}'::text[]),
    a.completed_at,
    count(ans.id)::bigint
  from public.tax_academy_attempts a
  left join public.tax_academy_practical_results r
    on r.attempt_id = a.id and r.org_id = a.org_id
  left join public.tax_academy_answers ans
    on ans.attempt_id = a.id and ans.org_id = a.org_id
  where a.org_id = v_org
    and a.status in ('submitted','completed','remediate')
    and not exists (
      select 1
      from public.tax_academy_reviewer_signoffs s
      where s.org_id = a.org_id
        and s.subject_type = 'attempt'
        and s.subject_id = a.id
        and s.decision = 'approved'
    )
  group by a.id, a.org_id, a.user_id, a.case_id, a.case_version,
           r.weighted_score, r.critical_failure_codes, a.completed_at
  order by a.completed_at asc nulls last, a.started_at asc;
end;
$$;

revoke all on function public.tax_academy_list_review_queue() from public, anon;
grant execute on function public.tax_academy_list_review_queue() to authenticated, service_role;

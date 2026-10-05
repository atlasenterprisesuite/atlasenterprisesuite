-- ATLAS Tax Academy protected exam engine.
-- Hidden grading material is intentionally NOT seeded in source control.
-- Production exam banks must be loaded through a privileged database channel.

create table if not exists public.tax_academy_exams (
  id text primary key,
  tax_year integer not null,
  version text not null,
  title text not null,
  mode text not null check (mode in ('exam','manual_practical')),
  passing_score numeric not null check (passing_score >= 0 and passing_score <= 100),
  rule_pack_status text not null default 'training_current' check (rule_pack_status in ('draft','training_current','production_certified','retired')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tax_academy_questions (
  exam_id text not null references public.tax_academy_exams(id) on delete cascade,
  question_id text not null,
  ordinal integer not null check (ordinal > 0),
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  expected_value jsonb,
  weight numeric not null default 1 check (weight > 0),
  critical_failure_code text,
  rationale text,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (exam_id, question_id),
  unique (exam_id, ordinal)
);

alter table public.tax_academy_exams enable row level security;
alter table public.tax_academy_questions enable row level security;

-- There are deliberately no authenticated SELECT policies on the protected bank.
revoke all on public.tax_academy_exams from anon, authenticated;
revoke all on public.tax_academy_questions from anon, authenticated;
grant all on public.tax_academy_exams, public.tax_academy_questions to service_role;

create unique index if not exists tax_academy_practical_results_attempt_unique
  on public.tax_academy_practical_results(attempt_id);

create or replace function public.tax_academy_get_exam_payload(p_exam_id text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_org uuid := public.tax_actor_org();
  v_exam public.tax_academy_exams%rowtype;
  v_questions jsonb;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Authentication and active organization required';
  end if;
  if not public.has_identity_permission(v_org,'tax.read') then
    raise exception 'Tax read permission required';
  end if;

  select * into v_exam
    from public.tax_academy_exams e
   where e.id = p_exam_id
     and e.active = true;

  if not found then
    raise exception 'Exam unavailable';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'questionId', q.question_id,
      'prompt', q.prompt,
      'options', q.options
    ) order by q.ordinal
  ), '[]'::jsonb)
    into v_questions
    from public.tax_academy_questions q
   where q.exam_id = v_exam.id;

  return jsonb_build_object(
    'examId', v_exam.id,
    'title', v_exam.title,
    'version', v_exam.version,
    'taxYear', v_exam.tax_year,
    'mode', v_exam.mode,
    'passingScore', v_exam.passing_score,
    'rulePackStatus', v_exam.rule_pack_status,
    'questions', v_questions
  );
end
$$;

-- Keep generic completion separate from grading so practical/candidate workflows remain compatible.
create or replace function public.tax_academy_complete_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_org uuid := public.tax_actor_org();
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Authentication and active organization required';
  end if;

  update public.tax_academy_attempts
     set status='submitted', completed_at=coalesce(completed_at,now())
   where id=p_attempt_id
     and org_id=v_org
     and user_id=auth.uid()
     and status='in_progress';

  if not found and not exists (
    select 1 from public.tax_academy_attempts
     where id=p_attempt_id and org_id=v_org and user_id=auth.uid() and status='submitted'
  ) then
    raise exception 'Attempt unavailable';
  end if;
end
$$;

create or replace function public.tax_academy_grade_attempt(p_attempt_id uuid)
returns table(score numeric, passed boolean, critical_failures text[])
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_org uuid := public.tax_actor_org();
  v_attempt public.tax_academy_attempts%rowtype;
  v_exam public.tax_academy_exams%rowtype;
  v_score numeric;
  v_passed boolean;
  v_critical text[] := '{}'::text[];
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Authentication and active organization required';
  end if;

  select * into v_attempt
    from public.tax_academy_attempts a
   where a.id = p_attempt_id
     and a.org_id = v_org
     and a.user_id = auth.uid();

  if not found then
    raise exception 'Attempt unavailable';
  end if;
  if v_attempt.status <> 'submitted' then
    raise exception 'Attempt must be submitted before grading';
  end if;
  if v_attempt.case_id not like 'exam:%' then
    raise exception 'Attempt is not an exam';
  end if;

  select * into v_exam
    from public.tax_academy_exams e
   where e.id = substring(v_attempt.case_id from 6)
     and e.version = v_attempt.case_version
     and e.active = true;

  if not found then
    raise exception 'Exam version unavailable';
  end if;

  if v_exam.mode = 'manual_practical' then
    return query select null::numeric, null::boolean, '{}'::text[];
    return;
  end if;

  with latest_answers as (
    select distinct on (a.question_id)
      a.question_id,
      a.submitted_value
    from public.tax_academy_answers a
    where a.attempt_id = p_attempt_id
      and a.org_id = v_org
      and a.user_id = auth.uid()
    order by a.question_id, a.submitted_at desc, a.id desc
  ), grading as (
    select
      q.weight,
      q.critical_failure_code,
      (la.submitted_value is not distinct from q.expected_value) as correct
    from public.tax_academy_questions q
    left join latest_answers la on la.question_id = q.question_id
    where q.exam_id = v_exam.id
  )
  select
    case when coalesce(sum(weight),0) = 0 then 0
         else round(100 * sum(case when correct then weight else 0 end) / sum(weight), 2)
    end,
    coalesce(array_agg(distinct critical_failure_code)
      filter (where critical_failure_code is not null and not correct), '{}'::text[])
  into v_score, v_critical
  from grading;

  v_passed := v_score >= v_exam.passing_score and cardinality(v_critical) = 0;

  insert into public.tax_academy_practical_results(
    org_id,user_id,attempt_id,weighted_score,passed,critical_failure_codes
  ) values (
    v_org,auth.uid(),p_attempt_id,v_score,v_passed,v_critical
  )
  on conflict (attempt_id) do update set
    weighted_score = excluded.weighted_score,
    passed = excluded.passed,
    critical_failure_codes = excluded.critical_failure_codes;

  return query select v_score, v_passed, v_critical;
end
$$;

grant execute on function public.tax_academy_get_exam_payload(text) to authenticated;
grant execute on function public.tax_academy_complete_attempt(uuid) to authenticated;
grant execute on function public.tax_academy_grade_attempt(uuid) to authenticated;

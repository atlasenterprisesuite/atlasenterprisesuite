-- ATLAS Tax Academy governed persistence. Candidate-visible rows store references, never hidden grading keys.
create table if not exists public.tax_academy_attempts (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id), case_id text not null, case_version text not null, mode text not null check(mode in ('practice','exam','capstone')),
 status text not null default 'in_progress', started_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.tax_academy_answers (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 attempt_id uuid not null references public.tax_academy_attempts(id) on delete cascade, user_id uuid not null references auth.users(id),
 question_id text not null, submitted_value jsonb not null default '{}'::jsonb, submitted_at timestamptz not null default now()
);
create table if not exists public.tax_academy_practical_results (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id), attempt_id uuid not null references public.tax_academy_attempts(id), weighted_score numeric not null,
 passed boolean not null, critical_failure_codes text[] not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.tax_academy_user_specialties (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id), specialty_id text not null, verified_at timestamptz not null default now()
);
create table if not exists public.tax_academy_user_level_history (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id), level_id text not null check(level_id in ('A0','A1','A2','A3','A4','A5','A6','A7','A8')),
 decision_reference text not null, granted_at timestamptz not null default now(), granted_by uuid references auth.users(id)
);
create table if not exists public.tax_academy_supervised_returns (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id), return_id uuid not null references public.tax_returns(id), scope_level text not null,
 reviewer_user_id uuid references auth.users(id), review_state text not null default 'pending', created_at timestamptz not null default now()
);
create table if not exists public.tax_academy_reviewer_signoffs (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id), reviewer_user_id uuid not null references auth.users(id), subject_type text not null,
 subject_id uuid not null, decision text not null check(decision in ('approved','remediate','rejected')), reviewer_note_reference text, created_at timestamptz not null default now()
);
create table if not exists public.tax_academy_recertifications (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id), tax_year integer not null, ce_hours numeric not null default 0,
 status text not null default 'pending', verified_by uuid references auth.users(id), verified_at timestamptz
);

alter table public.tax_academy_attempts enable row level security;
alter table public.tax_academy_answers enable row level security;
alter table public.tax_academy_practical_results enable row level security;
alter table public.tax_academy_user_specialties enable row level security;
alter table public.tax_academy_user_level_history enable row level security;
alter table public.tax_academy_supervised_returns enable row level security;
alter table public.tax_academy_reviewer_signoffs enable row level security;
alter table public.tax_academy_recertifications enable row level security;

create policy tax_academy_attempts_read on public.tax_academy_attempts for select to authenticated using (auth.uid()=user_id and public.has_identity_permission(org_id,'tax.read'));
create policy tax_academy_answers_read on public.tax_academy_answers for select to authenticated using (auth.uid()=user_id and public.has_identity_permission(org_id,'tax.read'));
create policy tax_academy_results_read on public.tax_academy_practical_results for select to authenticated using (auth.uid()=user_id and public.has_identity_permission(org_id,'tax.read'));
create policy tax_academy_specialties_read on public.tax_academy_user_specialties for select to authenticated using (auth.uid()=user_id and public.has_identity_permission(org_id,'tax.read'));
create policy tax_academy_levels_read on public.tax_academy_user_level_history for select to authenticated using (auth.uid()=user_id and public.has_identity_permission(org_id,'tax.read'));
create policy tax_academy_supervised_read on public.tax_academy_supervised_returns for select to authenticated using (auth.uid()=user_id and public.has_identity_permission(org_id,'tax.read'));
create policy tax_academy_signoffs_read on public.tax_academy_reviewer_signoffs for select to authenticated using (auth.uid()=user_id and public.has_identity_permission(org_id,'tax.read'));
create policy tax_academy_recert_read on public.tax_academy_recertifications for select to authenticated using (auth.uid()=user_id and public.has_identity_permission(org_id,'tax.read'));

revoke all on public.tax_academy_attempts, public.tax_academy_answers, public.tax_academy_practical_results, public.tax_academy_user_specialties, public.tax_academy_user_level_history, public.tax_academy_supervised_returns, public.tax_academy_reviewer_signoffs, public.tax_academy_recertifications from anon, authenticated;
grant select on public.tax_academy_attempts, public.tax_academy_answers, public.tax_academy_practical_results, public.tax_academy_user_specialties, public.tax_academy_user_level_history, public.tax_academy_supervised_returns, public.tax_academy_reviewer_signoffs, public.tax_academy_recertifications to authenticated;
grant all on public.tax_academy_attempts, public.tax_academy_answers, public.tax_academy_practical_results, public.tax_academy_user_specialties, public.tax_academy_user_level_history, public.tax_academy_supervised_returns, public.tax_academy_reviewer_signoffs, public.tax_academy_recertifications to service_role;

create or replace function public.tax_academy_start_attempt(p_case_id text,p_case_version text,p_mode text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_org uuid:=public.tax_actor_org(); v_id uuid; begin
 if auth.uid() is null or v_org is null then raise exception 'Authentication and active organization required'; end if;
 insert into public.tax_academy_attempts(org_id,user_id,case_id,case_version,mode) values(v_org,auth.uid(),p_case_id,p_case_version,p_mode) returning id into v_id; return v_id; end $$;

create or replace function public.tax_academy_submit_answer(p_attempt_id uuid,p_question_id text,p_value jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_org uuid:=public.tax_actor_org(); v_id uuid; begin
 if not exists(select 1 from public.tax_academy_attempts where id=p_attempt_id and org_id=v_org and user_id=auth.uid()) then raise exception 'Attempt unavailable'; end if;
 insert into public.tax_academy_answers(org_id,attempt_id,user_id,question_id,submitted_value) values(v_org,p_attempt_id,auth.uid(),p_question_id,p_value) returning id into v_id; return v_id; end $$;

create or replace function public.tax_academy_complete_attempt(p_attempt_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin update public.tax_academy_attempts set status='submitted',completed_at=now() where id=p_attempt_id and org_id=public.tax_actor_org() and user_id=auth.uid(); end $$;

create or replace function public.tax_academy_record_reviewer_signoff(p_user_id uuid,p_subject_type text,p_subject_id uuid,p_decision text,p_note_reference text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_org uuid:=public.tax_actor_org(); v_id uuid; begin
 if not public.has_identity_permission(v_org,'tax.review') then raise exception 'Tax review permission required'; end if;
 insert into public.tax_academy_reviewer_signoffs(org_id,user_id,reviewer_user_id,subject_type,subject_id,decision,reviewer_note_reference) values(v_org,p_user_id,auth.uid(),p_subject_type,p_subject_id,p_decision,p_note_reference) returning id into v_id; return v_id; end $$;

create or replace function public.tax_academy_get_candidate_summary() returns table(attempts bigint,passed_practicals bigint,current_level text) language sql security definer set search_path=public as $$
 select (select count(*) from public.tax_academy_attempts a where a.org_id=public.tax_actor_org() and a.user_id=auth.uid()),
        (select count(*) from public.tax_academy_practical_results r where r.org_id=public.tax_actor_org() and r.user_id=auth.uid() and r.passed),
        (select h.level_id from public.tax_academy_user_level_history h where h.org_id=public.tax_actor_org() and h.user_id=auth.uid() order by h.granted_at desc limit 1);
$$;

grant execute on function public.tax_academy_start_attempt(text,text,text), public.tax_academy_submit_answer(uuid,text,jsonb), public.tax_academy_complete_attempt(uuid), public.tax_academy_get_candidate_summary() to authenticated;
grant execute on function public.tax_academy_record_reviewer_signoff(uuid,text,uuid,text,text) to authenticated;

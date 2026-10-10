create or replace function public.can_write_education_data(o uuid)
returns boolean
language sql
stable
set search_path to 'public','pg_temp'
as $$ select public.has_org_role(o,array['owner','admin','manager']) $$;

create table if not exists public.education_courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  code text not null,
  title text not null,
  description text,
  delivery_mode text not null default 'self_paced' check (delivery_mode in ('self_paced','instructor_led','blended','virtual','in_person')),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,id),
  unique(org_id,code)
);
create index if not exists education_courses_org_status_idx on public.education_courses(org_id,status,code);

create table if not exists public.education_learners (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid,
  employee_id text,
  external_ref text,
  name text not null,
  email text,
  status text not null default 'active' check (status in ('active','inactive','alumni','archived')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,id)
);
create index if not exists education_learners_org_status_idx on public.education_learners(org_id,status,name);
create unique index if not exists education_learners_org_user_uidx on public.education_learners(org_id,user_id) where user_id is not null;
create unique index if not exists education_learners_org_employee_uidx on public.education_learners(org_id,employee_id) where employee_id is not null;

create table if not exists public.education_enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  course_id uuid not null,
  learner_id uuid not null,
  status text not null default 'enrolled' check (status in ('enrolled','in_progress','completed','withdrawn')),
  progress numeric(5,2) not null default 0 check (progress>=0 and progress<=100),
  enrolled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(org_id,id),
  unique(org_id,course_id,learner_id),
  foreign key (org_id,course_id) references public.education_courses(org_id,id) on delete cascade,
  foreign key (org_id,learner_id) references public.education_learners(org_id,id) on delete cascade
);
create index if not exists education_enrollments_org_status_idx on public.education_enrollments(org_id,status,updated_at desc);

create table if not exists public.education_assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  course_id uuid not null,
  title text not null,
  passing_score numeric(5,2) not null default 70 check (passing_score>=0 and passing_score<=100),
  max_attempts integer not null default 1 check (max_attempts>0 and max_attempts<=100),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,id),
  foreign key (org_id,course_id) references public.education_courses(org_id,id) on delete cascade
);
create index if not exists education_assessments_org_course_idx on public.education_assessments(org_id,course_id,status);

create table if not exists public.education_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  assessment_id uuid not null,
  learner_id uuid not null,
  score numeric(5,2) not null check (score>=0 and score<=100),
  passed boolean not null,
  attempt integer not null default 1 check (attempt>0),
  metadata jsonb not null default '{}'::jsonb,
  submitted_by uuid default auth.uid(),
  submitted_at timestamptz not null default now(),
  unique(org_id,id),
  foreign key (org_id,assessment_id) references public.education_assessments(org_id,id) on delete cascade,
  foreign key (org_id,learner_id) references public.education_learners(org_id,id) on delete cascade
);
create index if not exists education_results_org_learner_idx on public.education_results(org_id,learner_id,submitted_at desc);

create table if not exists public.education_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  learner_id uuid not null,
  course_id uuid not null,
  credential_type text not null default 'completion',
  credential_code text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  issued_by uuid default auth.uid(),
  unique(org_id,id),
  unique(org_id,credential_code),
  foreign key (org_id,learner_id) references public.education_learners(org_id,id) on delete restrict,
  foreign key (org_id,course_id) references public.education_courses(org_id,id) on delete restrict
);
create index if not exists education_credentials_org_learner_idx on public.education_credentials(org_id,learner_id,issued_at desc);

create table if not exists public.education_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  actor_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists education_audit_org_idx on public.education_audit_events(org_id,created_at desc);

alter table public.education_courses enable row level security;
alter table public.education_learners enable row level security;
alter table public.education_enrollments enable row level security;
alter table public.education_assessments enable row level security;
alter table public.education_results enable row level security;
alter table public.education_credentials enable row level security;
alter table public.education_audit_events enable row level security;

create policy education_courses_read on public.education_courses for select to authenticated using (public.is_org_member(org_id));
create policy education_courses_write on public.education_courses for all to authenticated using (public.can_write_education_data(org_id)) with check (public.can_write_education_data(org_id));
create policy education_learners_read on public.education_learners for select to authenticated using (public.is_org_member(org_id));
create policy education_learners_write on public.education_learners for all to authenticated using (public.can_write_education_data(org_id)) with check (public.can_write_education_data(org_id));
create policy education_enrollments_read on public.education_enrollments for select to authenticated using (public.is_org_member(org_id));
create policy education_enrollments_write on public.education_enrollments for all to authenticated using (public.can_write_education_data(org_id)) with check (public.can_write_education_data(org_id));
create policy education_assessments_read on public.education_assessments for select to authenticated using (public.is_org_member(org_id));
create policy education_assessments_write on public.education_assessments for all to authenticated using (public.can_write_education_data(org_id)) with check (public.can_write_education_data(org_id));
create policy education_results_read on public.education_results for select to authenticated using (public.is_org_member(org_id));
create policy education_results_write on public.education_results for all to authenticated using (public.can_write_education_data(org_id)) with check (public.can_write_education_data(org_id));
create policy education_credentials_read on public.education_credentials for select to authenticated using (public.is_org_member(org_id));
create policy education_credentials_write on public.education_credentials for all to authenticated using (public.can_write_education_data(org_id)) with check (public.can_write_education_data(org_id));
create policy education_audit_read on public.education_audit_events for select to authenticated using (public.is_org_member(org_id));

create or replace function public.atlas_education_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  o uuid;
  rid uuid;
begin
  o := case when tg_op='DELETE' then old.org_id else new.org_id end;
  rid := case when tg_op='DELETE' then old.id else new.id end;
  insert into public.education_audit_events(org_id,actor_id,table_name,record_id,action,before_data,after_data)
  values(o,auth.uid(),tg_table_name,rid,tg_op,case when tg_op='INSERT' then null else to_jsonb(old) end,case when tg_op='DELETE' then null else to_jsonb(new) end);
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function public.atlas_education_audit_trigger() from public,anon,authenticated;

create trigger education_courses_audit after insert or update or delete on public.education_courses for each row execute function public.atlas_education_audit_trigger();
create trigger education_learners_audit after insert or update or delete on public.education_learners for each row execute function public.atlas_education_audit_trigger();
create trigger education_enrollments_audit after insert or update or delete on public.education_enrollments for each row execute function public.atlas_education_audit_trigger();
create trigger education_assessments_audit after insert or update or delete on public.education_assessments for each row execute function public.atlas_education_audit_trigger();
create trigger education_results_audit after insert or update or delete on public.education_results for each row execute function public.atlas_education_audit_trigger();
create trigger education_credentials_audit after insert or update or delete on public.education_credentials for each row execute function public.atlas_education_audit_trigger();

grant select,insert,update,delete on public.education_courses to authenticated;
grant select,insert,update,delete on public.education_learners to authenticated;
grant select,insert,update,delete on public.education_enrollments to authenticated;
grant select,insert,update,delete on public.education_assessments to authenticated;
grant select,insert,update,delete on public.education_results to authenticated;
grant select,insert,update,delete on public.education_credentials to authenticated;
grant select on public.education_audit_events to authenticated;

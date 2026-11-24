create table if not exists public.compliance_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subject_user_id uuid not null,
  module text not null check (length(trim(module)) > 0),
  subject_type text not null check (length(trim(subject_type)) > 0),
  requirement_type text not null check (length(trim(requirement_type)) > 0),
  status text not null check (status in ('action_required','submitted','under_review','approved','rejected','expired','waived')),
  requested_at timestamptz not null default now(),
  due_at timestamptz,
  expires_at timestamptz,
  eligibility_effect text check (eligibility_effect is null or eligibility_effect in ('none','warning','block_new_activity')),
  reason_code text,
  reason_text text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_requirement_scope_check check (tenant_id = organization_id)
);

create table if not exists public.compliance_submissions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.compliance_requirements(id) on delete cascade,
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subject_user_id uuid not null,
  submitted_by uuid not null,
  status text not null check (status in ('uploading','submitted','under_review','approved','rejected','superseded')),
  storage_bucket text not null check (storage_bucket = 'atlas-compliance-evidence'),
  storage_path text not null check (length(trim(storage_path)) > 0),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  sha256 text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  decision_reason text,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_submission_scope_check check (tenant_id = organization_id)
);

create table if not exists public.compliance_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null,
  subject_user_id uuid not null,
  requirement_id uuid references public.compliance_requirements(id) on delete set null,
  submission_id uuid references public.compliance_submissions(id) on delete set null,
  event_type text not null check (length(trim(event_type)) > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint compliance_audit_scope_check check (tenant_id = organization_id)
);

create index if not exists compliance_requirements_active_lookup_idx
  on public.compliance_requirements (organization_id, subject_user_id, module, requirement_type, status);

create index if not exists compliance_submissions_requirement_idx
  on public.compliance_submissions (requirement_id, submitted_at desc);

create index if not exists compliance_audit_requirement_created_idx
  on public.compliance_audit_events (requirement_id, created_at desc);

create unique index if not exists compliance_requirements_one_actionable_profile_photo
  on public.compliance_requirements (organization_id, subject_user_id, module, requirement_type)
  where module = 'ride'
    and requirement_type = 'profile_photo'
    and status in ('action_required','submitted','under_review','rejected');

alter table public.compliance_requirements enable row level security;
alter table public.compliance_submissions enable row level security;
alter table public.compliance_audit_events enable row level security;

drop policy if exists compliance_requirements_subject_or_reviewer_read on public.compliance_requirements;
create policy compliance_requirements_subject_or_reviewer_read
on public.compliance_requirements
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = compliance_requirements.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and (
        compliance_requirements.subject_user_id = auth.uid()
        or om.role in ('owner','admin','platform_admin')
      )
  )
);

drop policy if exists compliance_submissions_subject_or_reviewer_read on public.compliance_submissions;
create policy compliance_submissions_subject_or_reviewer_read
on public.compliance_submissions
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = compliance_submissions.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and (
        compliance_submissions.subject_user_id = auth.uid()
        or om.role in ('owner','admin','platform_admin')
      )
  )
);

drop policy if exists compliance_submissions_subject_insert on public.compliance_submissions;
create policy compliance_submissions_subject_insert
on public.compliance_submissions
for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and subject_user_id = auth.uid()
  and tenant_id = organization_id
  and exists (
    select 1 from public.organization_members om
    where om.org_id = compliance_submissions.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

drop policy if exists compliance_audit_subject_or_reviewer_read on public.compliance_audit_events;
create policy compliance_audit_subject_or_reviewer_read
on public.compliance_audit_events
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = compliance_audit_events.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and (
        compliance_audit_events.subject_user_id = auth.uid()
        or om.role in ('owner','admin','platform_admin')
      )
  )
);

revoke all on public.compliance_requirements from authenticated;
revoke all on public.compliance_submissions from authenticated;
revoke all on public.compliance_audit_events from authenticated;

grant select on public.compliance_requirements to authenticated;
grant select, insert on public.compliance_submissions to authenticated;
grant select on public.compliance_audit_events to authenticated;

-- Private evidence bucket: public: false. Browser access is mediated by atlas-ride-compliance.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atlas-compliance-evidence',
  'atlas-compliance-evidence',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on table public.compliance_requirements is
  'Organization-scoped ATLAS compliance requirements. tenant_id currently equals organization_id by canonical tenancy contract.';
comment on table public.compliance_submissions is
  'Private evidence references and review lifecycle metadata; image bytes remain in private Supabase Storage.';
comment on table public.compliance_audit_events is
  'Sensitive compliance lifecycle audit trail without image bytes, signed URLs, provider secrets, or biometric material.';

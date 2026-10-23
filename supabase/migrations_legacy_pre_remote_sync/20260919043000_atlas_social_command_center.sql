-- ATLAS Social Command Center: tenant-scoped inbox and schedule persistence.
-- External provider execution remains fail-closed until an authorized connection exists.

insert into public.identity_permissions (code, description)
values
  ('social.read', 'Read organization social inbox and scheduled publication records.'),
  ('social.write', 'Create and triage organization social inbox and scheduled publication records.'),
  ('social.manage', 'Administer organization social operations and provider handoffs.'),
  ('crm.write', 'Create CRM records through an authorized provider connection.')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'social.read'), ('owner', 'social.write'), ('owner', 'social.manage'), ('owner', 'crm.write'),
  ('admin', 'social.read'), ('admin', 'social.write'), ('admin', 'social.manage'), ('admin', 'crm.write')
on conflict do nothing;

create table if not exists public.atlas_social_inbox_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null check (platform in ('instagram','facebook','x','linkedin','tiktok','youtube')),
  external_thread_id text,
  contact_name text not null check (char_length(trim(contact_name)) > 0),
  handle text,
  preview text not null check (char_length(trim(preview)) > 0),
  last_message_at timestamptz not null,
  unread_count integer not null default 0 check (unread_count >= 0),
  status text not null default 'open' check (status in ('open','waiting','resolved')),
  source text not null default 'imported' check (source in ('imported','provider')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists atlas_social_inbox_provider_thread_unique
  on public.atlas_social_inbox_threads(org_id, platform, external_thread_id)
  where external_thread_id is not null;

create index if not exists atlas_social_inbox_org_recent_idx
  on public.atlas_social_inbox_threads(org_id, last_message_at desc);

create table if not exists public.atlas_social_scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null check (platform in ('instagram','facebook','x','linkedin','tiktok','youtube')),
  caption text not null check (char_length(trim(caption)) > 0),
  scheduled_for timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft','scheduled','blocked_connection','ready','publishing','published','failed','cancelled')),
  provider_connection_state text not null default 'not_configured'
    check (provider_connection_state in ('not_configured','ready','unavailable')),
  media_manifest jsonb not null default '[]'::jsonb,
  last_error_code text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_for > created_at)
);

create index if not exists atlas_social_schedule_org_time_idx
  on public.atlas_social_scheduled_posts(org_id, scheduled_for asc);

alter table public.atlas_social_inbox_threads enable row level security;
alter table public.atlas_social_scheduled_posts enable row level security;

revoke all on public.atlas_social_inbox_threads from anon, authenticated;
revoke all on public.atlas_social_scheduled_posts from anon, authenticated;

grant select, insert, update on public.atlas_social_inbox_threads to authenticated;
grant select, insert, update on public.atlas_social_scheduled_posts to authenticated;
grant all on public.atlas_social_inbox_threads to service_role;
grant all on public.atlas_social_scheduled_posts to service_role;

drop policy if exists atlas_social_inbox_read on public.atlas_social_inbox_threads;
create policy atlas_social_inbox_read on public.atlas_social_inbox_threads
for select to authenticated
using (
  public.is_org_member(org_id)
  and (
    public.has_identity_permission(org_id,'social.read')
    or public.has_identity_permission(org_id,'social.manage')
  )
);

drop policy if exists atlas_social_inbox_insert on public.atlas_social_inbox_threads;
create policy atlas_social_inbox_insert on public.atlas_social_inbox_threads
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_org_member(org_id)
  and (
    public.has_identity_permission(org_id,'social.write')
    or public.has_identity_permission(org_id,'social.manage')
  )
);

drop policy if exists atlas_social_inbox_update on public.atlas_social_inbox_threads;
create policy atlas_social_inbox_update on public.atlas_social_inbox_threads
for update to authenticated
using (
  public.has_identity_permission(org_id,'social.write')
  or public.has_identity_permission(org_id,'social.manage')
)
with check (
  public.has_identity_permission(org_id,'social.write')
  or public.has_identity_permission(org_id,'social.manage')
);

drop policy if exists atlas_social_schedule_read on public.atlas_social_scheduled_posts;
create policy atlas_social_schedule_read on public.atlas_social_scheduled_posts
for select to authenticated
using (
  public.is_org_member(org_id)
  and (
    public.has_identity_permission(org_id,'social.read')
    or public.has_identity_permission(org_id,'social.manage')
  )
);

drop policy if exists atlas_social_schedule_insert on public.atlas_social_scheduled_posts;
create policy atlas_social_schedule_insert on public.atlas_social_scheduled_posts
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_org_member(org_id)
  and (
    public.has_identity_permission(org_id,'social.write')
    or public.has_identity_permission(org_id,'social.manage')
  )
);

drop policy if exists atlas_social_schedule_update on public.atlas_social_scheduled_posts;
create policy atlas_social_schedule_update on public.atlas_social_scheduled_posts
for update to authenticated
using (
  public.has_identity_permission(org_id,'social.write')
  or public.has_identity_permission(org_id,'social.manage')
)
with check (
  public.has_identity_permission(org_id,'social.write')
  or public.has_identity_permission(org_id,'social.manage')
);

drop trigger if exists atlas_social_inbox_audit on public.atlas_social_inbox_threads;
create trigger atlas_social_inbox_audit
after insert or update or delete on public.atlas_social_inbox_threads
for each row execute function public.audit_row_change();

drop trigger if exists atlas_social_schedule_audit on public.atlas_social_scheduled_posts;
create trigger atlas_social_schedule_audit
after insert or update or delete on public.atlas_social_scheduled_posts
for each row execute function public.audit_row_change();

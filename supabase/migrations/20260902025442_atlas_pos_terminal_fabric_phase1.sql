insert into public.identity_permissions(code,description) values
('pos.devices.read','Read ATLAS POS registers and devices'),
('pos.devices.manage','Manage ATLAS POS registers and devices')
on conflict (code) do nothing;

insert into public.identity_role_permissions(role,permission_code)
select role,permission_code from (values
  ('owner','pos.devices.read'),('owner','pos.devices.manage'),
  ('admin','pos.devices.read'),('admin','pos.devices.manage'),
  ('manager','pos.devices.read'),('manager','pos.devices.manage'),
  ('staff','pos.devices.read'),('accountant','pos.devices.read'),('viewer','pos.devices.read')
) as x(role,permission_code)
on conflict do nothing;

create table if not exists public.pos_registers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  code text not null,
  name text not null,
  status text not null default 'active' check(status in ('active','disabled','maintenance')),
  configuration jsonb not null default '{}'::jsonb check(jsonb_typeof(configuration)='object'),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,location_id,code)
);

create index if not exists pos_registers_org_location_idx
on public.pos_registers(org_id,location_id,status,code);

create table if not exists public.pos_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  location_id uuid references public.inventory_locations(id) on delete restrict,
  register_id uuid references public.pos_registers(id) on delete set null,
  device_type text not null check(device_type in ('countertop','customer_display','handheld','payment_reader','barcode_scanner','receipt_printer','cash_drawer')),
  provider text,
  provider_device_id text,
  name text not null,
  status text not null default 'unpaired' check(status in ('unpaired','paired','disabled','maintenance')),
  capabilities jsonb not null default '[]'::jsonb check(jsonb_typeof(capabilities)='array'),
  last_verified_at timestamptz,
  last_verified_state jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pos_devices_org_register_idx
on public.pos_devices(org_id,register_id,status,device_type);
create unique index if not exists pos_devices_provider_identity_uq
on public.pos_devices(org_id,provider,provider_device_id)
where provider is not null and provider_device_id is not null;

create table if not exists public.pos_device_pairing_challenges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  device_id uuid not null references public.pos_devices(id) on delete cascade,
  challenge_hash text not null unique check(challenge_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists pos_pairing_org_device_idx
on public.pos_device_pairing_challenges(org_id,device_id,expires_at desc);

create table if not exists public.pos_terminal_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  actor_user_id uuid default auth.uid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pos_terminal_audit_org_idx
on public.pos_terminal_audit_events(org_id,created_at desc);

create or replace function public.validate_pos_terminal_scope()
returns trigger
language plpgsql
security invoker
set search_path='public','pg_temp'
as $$
declare
  v_register_location uuid;
begin
  if new.location_id is not null and not exists(
    select 1 from public.inventory_locations l
    where l.id=new.location_id and l.org_id=new.org_id and l.status='active'
  ) then
    raise exception 'pos_terminal_location_scope_invalid';
  end if;

  if tg_table_name='pos_devices' and new.register_id is not null then
    select r.location_id into v_register_location
    from public.pos_registers r
    where r.id=new.register_id and r.org_id=new.org_id;
    if not found then raise exception 'pos_terminal_register_scope_invalid'; end if;
    if new.location_id is null or new.location_id<>v_register_location then
      raise exception 'pos_terminal_register_location_mismatch';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pos_register_scope_guard on public.pos_registers;
create trigger pos_register_scope_guard before insert or update on public.pos_registers
for each row execute function public.validate_pos_terminal_scope();

drop trigger if exists pos_device_scope_guard on public.pos_devices;
create trigger pos_device_scope_guard before insert or update on public.pos_devices
for each row execute function public.validate_pos_terminal_scope();

create or replace function public.validate_pos_pairing_scope()
returns trigger
language plpgsql
security invoker
set search_path='public','pg_temp'
as $$
begin
  if not exists(
    select 1 from public.pos_devices d
    where d.id=new.device_id and d.org_id=new.org_id and d.status='unpaired'
  ) then
    raise exception 'pos_pairing_device_scope_invalid';
  end if;
  if new.expires_at<=now() then
    raise exception 'pos_pairing_expiry_must_be_future';
  end if;
  return new;
end;
$$;

drop trigger if exists pos_pairing_scope_guard on public.pos_device_pairing_challenges;
create trigger pos_pairing_scope_guard before insert or update on public.pos_device_pairing_challenges
for each row execute function public.validate_pos_pairing_scope();

create or replace function public.audit_pos_terminal_change()
returns trigger
language plpgsql
security invoker
set search_path='public','pg_temp'
as $$
begin
  insert into public.pos_terminal_audit_events(org_id,entity_type,entity_id,action,before_state,after_state)
  values(
    coalesce(new.org_id,old.org_id),
    tg_table_name,
    coalesce(new.id,old.id),
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new,old);
end;
$$;

drop trigger if exists pos_registers_audit on public.pos_registers;
create trigger pos_registers_audit after insert or update or delete on public.pos_registers
for each row execute function public.audit_pos_terminal_change();

drop trigger if exists pos_devices_audit on public.pos_devices;
create trigger pos_devices_audit after insert or update or delete on public.pos_devices
for each row execute function public.audit_pos_terminal_change();

create or replace function public.pos_consume_device_pairing_challenge(
  p_org_id uuid,
  p_challenge_hash text
) returns uuid
language plpgsql
security invoker
set search_path='public','pg_temp'
as $$
declare
  v_challenge public.pos_device_pairing_challenges%rowtype;
  v_device_id uuid;
begin
  if not public.has_identity_permission(p_org_id,'pos.devices.manage') then
    raise exception 'pos_device_manage_denied';
  end if;

  select * into v_challenge
  from public.pos_device_pairing_challenges
  where org_id=p_org_id
    and challenge_hash=p_challenge_hash
    and consumed_at is null
    and expires_at>now()
  for update;

  if not found then raise exception 'pos_pairing_challenge_invalid_or_expired'; end if;

  update public.pos_device_pairing_challenges
  set consumed_at=now()
  where id=v_challenge.id;

  update public.pos_devices
  set status='paired',updated_at=now()
  where id=v_challenge.device_id and org_id=p_org_id and status='unpaired'
  returning id into v_device_id;

  if v_device_id is null then raise exception 'pos_device_not_pairable'; end if;
  return v_device_id;
end;
$$;

revoke all on function public.pos_consume_device_pairing_challenge(uuid,text) from public,anon;
grant execute on function public.pos_consume_device_pairing_challenge(uuid,text) to authenticated;

alter table public.pos_registers enable row level security;
alter table public.pos_devices enable row level security;
alter table public.pos_device_pairing_challenges enable row level security;
alter table public.pos_terminal_audit_events enable row level security;

create policy pos_registers_read on public.pos_registers for select to authenticated
using(public.is_org_member(org_id) and public.has_identity_permission(org_id,'pos.devices.read'));
create policy pos_registers_manage on public.pos_registers for all to authenticated
using(public.has_identity_permission(org_id,'pos.devices.manage'))
with check(public.has_identity_permission(org_id,'pos.devices.manage'));

create policy pos_devices_read on public.pos_devices for select to authenticated
using(public.is_org_member(org_id) and public.has_identity_permission(org_id,'pos.devices.read'));
create policy pos_devices_manage on public.pos_devices for all to authenticated
using(public.has_identity_permission(org_id,'pos.devices.manage'))
with check(public.has_identity_permission(org_id,'pos.devices.manage'));

create policy pos_pairing_manage on public.pos_device_pairing_challenges for all to authenticated
using(public.has_identity_permission(org_id,'pos.devices.manage'))
with check(public.has_identity_permission(org_id,'pos.devices.manage'));

create policy pos_terminal_audit_read on public.pos_terminal_audit_events for select to authenticated
using(public.is_org_member(org_id) and public.has_identity_permission(org_id,'pos.devices.read'));
create policy pos_terminal_audit_insert on public.pos_terminal_audit_events for insert to authenticated
with check(public.has_identity_permission(org_id,'pos.devices.manage'));

grant select,insert,update,delete on public.pos_registers to authenticated;
grant select,insert,update,delete on public.pos_devices to authenticated;
grant select,insert,update,delete on public.pos_device_pairing_challenges to authenticated;
grant select,insert on public.pos_terminal_audit_events to authenticated;

-- ATLAS Browser Operator: bounded action payloads for audited Local Agent commands

alter table public.atlas_local_device_commands
  add column if not exists action_payload jsonb not null default '{}'::jsonb;

alter table public.atlas_local_device_commands
  drop constraint if exists atlas_local_device_commands_action_payload_shape;

alter table public.atlas_local_device_commands
  add constraint atlas_local_device_commands_action_payload_shape check (
    jsonb_typeof(action_payload) = 'object'
    and octet_length(action_payload::text) <= 8192
  );

comment on column public.atlas_local_device_commands.action_payload is
  'Bounded non-secret parameters for an audited local command. Secrets, cookies, authorization headers and credentials are prohibited.';

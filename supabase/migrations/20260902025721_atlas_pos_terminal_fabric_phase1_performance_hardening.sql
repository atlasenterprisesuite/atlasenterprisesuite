create index if not exists pos_registers_location_id_idx on public.pos_registers(location_id);
create index if not exists pos_devices_location_id_idx on public.pos_devices(location_id);
create index if not exists pos_devices_register_id_idx on public.pos_devices(register_id);
create index if not exists pos_device_pairing_challenges_device_id_idx on public.pos_device_pairing_challenges(device_id);

drop policy if exists pos_registers_manage on public.pos_registers;
create policy pos_registers_insert on public.pos_registers for insert to authenticated
with check(public.has_identity_permission(org_id,'pos.devices.manage'));
create policy pos_registers_update on public.pos_registers for update to authenticated
using(public.has_identity_permission(org_id,'pos.devices.manage'))
with check(public.has_identity_permission(org_id,'pos.devices.manage'));
create policy pos_registers_delete on public.pos_registers for delete to authenticated
using(public.has_identity_permission(org_id,'pos.devices.manage'));

drop policy if exists pos_devices_manage on public.pos_devices;
create policy pos_devices_insert on public.pos_devices for insert to authenticated
with check(public.has_identity_permission(org_id,'pos.devices.manage'));
create policy pos_devices_update on public.pos_devices for update to authenticated
using(public.has_identity_permission(org_id,'pos.devices.manage'))
with check(public.has_identity_permission(org_id,'pos.devices.manage'));
create policy pos_devices_delete on public.pos_devices for delete to authenticated
using(public.has_identity_permission(org_id,'pos.devices.manage'));

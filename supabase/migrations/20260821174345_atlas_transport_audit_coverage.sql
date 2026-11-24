drop trigger if exists atlas_audit_transport_vehicles on public.transport_vehicles;
create trigger atlas_audit_transport_vehicles
after insert or update or delete on public.transport_vehicles
for each row execute function public.audit_row_change();

drop trigger if exists atlas_audit_transport_drivers on public.transport_drivers;
create trigger atlas_audit_transport_drivers
after insert or update or delete on public.transport_drivers
for each row execute function public.audit_row_change();

drop trigger if exists atlas_audit_transport_trips on public.transport_trips;
create trigger atlas_audit_transport_trips
after insert or update or delete on public.transport_trips
for each row execute function public.audit_row_change();

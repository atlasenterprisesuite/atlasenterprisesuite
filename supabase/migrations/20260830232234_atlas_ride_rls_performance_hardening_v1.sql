create index if not exists ride_driver_zone_preferences_org_zone_idx on public.ride_driver_zone_preferences(org_id, zone_id);

drop policy if exists ride_audit_insert on public.ride_audit;
create policy ride_audit_insert on public.ride_audit for insert to authenticated with check (public.is_org_member(org_id) and actor_id = (select auth.uid()));

drop policy if exists ride_compliance_insert on public.ride_compliance_items;
create policy ride_compliance_insert on public.ride_compliance_items for insert to authenticated with check (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id)));
drop policy if exists ride_compliance_read on public.ride_compliance_items;
create policy ride_compliance_read on public.ride_compliance_items for select to authenticated using (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id)));
drop policy if exists ride_compliance_update on public.ride_compliance_items;
create policy ride_compliance_update on public.ride_compliance_items for update to authenticated using (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id)));

drop policy if exists ride_preferences_all on public.ride_driver_preferences;
create policy ride_preferences_all on public.ride_driver_preferences for all to authenticated using (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id)));

drop policy if exists ride_driver_profiles_insert on public.ride_driver_profiles;
create policy ride_driver_profiles_insert on public.ride_driver_profiles for insert to authenticated with check (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id)));
drop policy if exists ride_driver_profiles_read on public.ride_driver_profiles;
create policy ride_driver_profiles_read on public.ride_driver_profiles for select to authenticated using (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id)));
drop policy if exists ride_driver_profiles_update on public.ride_driver_profiles;
create policy ride_driver_profiles_update on public.ride_driver_profiles for update to authenticated using (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id)));

drop policy if exists ride_zone_preferences_all on public.ride_driver_zone_preferences;
create policy ride_zone_preferences_all on public.ride_driver_zone_preferences for all to authenticated using (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id)));

drop policy if exists ride_incidents_all on public.ride_incidents;
create policy ride_incidents_all on public.ride_incidents for all to authenticated using (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id)));

drop policy if exists ride_mileage_all on public.ride_mileage_entries;
create policy ride_mileage_all on public.ride_mileage_entries for all to authenticated using (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id)));

drop policy if exists ride_vehicles_all on public.ride_vehicles;
create policy ride_vehicles_all on public.ride_vehicles for all to authenticated using (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id))) with check (public.is_org_member(org_id) and (user_id = (select auth.uid()) or public.can_manage_ride(org_id)));

drop policy if exists ride_zones_write on public.ride_zones;
create policy ride_zones_insert on public.ride_zones for insert to authenticated with check (public.can_manage_ride(org_id));
create policy ride_zones_update on public.ride_zones for update to authenticated using (public.can_manage_ride(org_id)) with check (public.can_manage_ride(org_id));
create policy ride_zones_delete on public.ride_zones for delete to authenticated using (public.can_manage_ride(org_id));

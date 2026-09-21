import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260921_ride_os_core.sql'), 'utf8');

describe('ATLAS Ride OS core schema contract', () => {
  it('creates one canonical driver vehicle and trip domain', () => {
    for (const table of [
      'ride_driver_profiles',
      'ride_vehicles',
      'ride_driver_vehicle_assignments',
      'ride_trips',
      'ride_trip_events'
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('keeps tenant and organization scope coupled for the current tenancy contract', () => {
    expect(sql).toContain('ride_driver_profile_scope_check check (tenant_id = organization_id)');
    expect(sql).toContain('ride_vehicle_scope_check check (tenant_id = organization_id)');
    expect(sql).toContain('ride_trip_scope_check check (tenant_id = organization_id)');
    expect(sql).toContain('ride_trip_event_scope_check check (tenant_id = organization_id)');
  });

  it('makes Trip the central mobility record and references external financial domains instead of duplicating them', () => {
    expect(sql).toContain('trip_id uuid not null references public.ride_trips(id)');
    expect(sql).toContain('pricing_policy_reference text');
    expect(sql).toContain('payment_reference text');
    expect(sql).toContain('accounting_reference text');
    expect(sql).toContain('tax_reference text');
    expect(sql).not.toMatch(/create table if not exists public\.ride_(general_ledger|journal_entries|tax_returns|payment_transactions)/);
  });

  it('keeps direct authenticated browser writes closed until the Ride operations service exists', () => {
    expect(sql).toContain('revoke all on public.ride_driver_profiles from authenticated');
    expect(sql).toContain('revoke all on public.ride_vehicles from authenticated');
    expect(sql).toContain('revoke all on public.ride_trips from authenticated');
    expect(sql).toContain('revoke all on public.ride_trip_events from authenticated');
  });

  it('stores money only as integer minor units with ISO currency metadata', () => {
    expect(sql).toContain("currency text check (currency is null or currency ~ '^[A-Z]{3}$')");
    expect(sql).toContain('quoted_fare_minor bigint');
    expect(sql).toContain('final_fare_minor bigint');
  });
});

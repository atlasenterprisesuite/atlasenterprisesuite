import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260921_ride_os_core.sql'), 'utf8');

describe('ATLAS Ride OS core schema extension contract', () => {
  it('reuses the existing production driver and vehicle tables instead of creating duplicates', () => {
    expect(sql).not.toContain('create table if not exists public.ride_driver_profiles');
    expect(sql).not.toContain('create table if not exists public.ride_vehicles');
    expect(sql).toContain('references public.ride_driver_profiles (org_id, id)');
    expect(sql).toContain('references public.ride_vehicles (org_id, id)');
  });

  it('adds only the missing canonical assignment trip and event records', () => {
    for (const table of [
      'ride_driver_vehicle_assignments',
      'ride_trips',
      'ride_trip_events'
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('keeps all new mobility relations organization scoped', () => {
    expect(sql).toContain('ride_driver_vehicle_driver_scope_fkey');
    expect(sql).toContain('ride_driver_vehicle_vehicle_scope_fkey');
    expect(sql).toContain('ride_trip_driver_scope_fkey');
    expect(sql).toContain('ride_trip_vehicle_scope_fkey');
    expect(sql).toContain('ride_trip_event_trip_scope_fkey');
  });

  it('makes Trip the central mobility record and references canonical financial domains', () => {
    expect(sql).toContain('trip_id uuid not null');
    expect(sql).toContain('pricing_policy_reference text');
    expect(sql).toContain('payment_reference text');
    expect(sql).toContain('accounting_reference text');
    expect(sql).toContain('tax_reference text');
    expect(sql).not.toMatch(/create table if not exists public\.ride_(general_ledger|journal_entries|tax_returns|payment_transactions)/);
  });

  it('does not revoke or replace the permissions of existing Ride driver and vehicle records', () => {
    expect(sql).not.toContain('revoke all on public.ride_driver_profiles');
    expect(sql).not.toContain('revoke all on public.ride_vehicles');
    expect(sql).toContain('revoke all on public.ride_trips from anon, authenticated');
  });

  it('stores authoritative fares in integer minor units with ISO currency metadata', () => {
    expect(sql).toContain("currency text check (currency is null or currency ~ '^[A-Z]{3}$')");
    expect(sql).toContain('quoted_fare_minor bigint');
    expect(sql).toContain('final_fare_minor bigint');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ORGANIZATION_OS_POLICY,
  DEFAULT_PERSONAL_OS_SETTINGS,
  effectiveOsSettings,
  normalizeOrganizationOsPolicy,
  normalizePersonalOsSettings
} from '../../packages/core/src/os-settings';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('ATLAS OS Settings P1', () => {
  it('normalizes personal settings and applies bounded values', () => {
    expect(normalizePersonalOsSettings({
      syncEnabled: false,
      backupRetentionDays: 999,
      notificationClasses: ['security', 'security', 'unknown']
    })).toEqual({
      ...DEFAULT_PERSONAL_OS_SETTINGS,
      syncEnabled: false,
      backupRetentionDays: 365,
      notificationClasses: ['security']
    });
  });

  it('lets organization policy enforce stricter backup and adapter requirements', () => {
    const personal = normalizePersonalOsSettings({
      autoBackupEnabled: false,
      backupRetentionDays: 7,
      crossDeviceHandoffEnabled: true
    });
    const policy = normalizeOrganizationOsPolicy({
      forceBackupEnabled: true,
      minimumBackupRetentionDays: 30,
      requireVerifiedAdapters: true,
      crossDeviceHandoffAllowed: false
    });
    const effective = effectiveOsSettings(personal, policy);
    expect(effective.autoBackupEnabled).toBe(true);
    expect(effective.backupRetentionDays).toBe(30);
    expect(effective.crossDeviceHandoffEnabled).toBe(false);
    expect(effective.requireVerifiedAdapters).toBe(true);
    expect(DEFAULT_ORGANIZATION_OS_POLICY.deviceActionsMode).toBe('confirm');
  });

  it('reuses canonical user preferences, organization settings and audit rails', () => {
    const sql = source('supabase/migrations/20260915100000_os_settings_p1.sql').toLowerCase();
    expect(sql).toContain('alter table public.atlas_user_preferences');
    expect(sql).toContain('alter table public.organization_settings');
    expect(sql).toContain('insert into public.audit_logs');
    expect(sql).not.toContain('create table if not exists public.os_user_settings');
    expect(sql).not.toContain('create table if not exists public.os_organization_settings');
    expect(sql).not.toContain('create table if not exists public.os_settings_audit');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('organization_members');
    expect(sql).toContain('get_os_settings');
    expect(sql).toContain('update_os_settings');
    expect(sql).toContain('version_conflict');
    expect(sql).toContain("role in ('owner', 'admin')");
    expect(sql).toContain("preferences -> 'os'");
    expect(sql).toContain("settings -> 'os'");
  });

  it('does not accept organization id from the browser settings write contract', () => {
    const api = source('apps/web/src/modules/os/settingsApi.ts');
    expect(api).toContain("'/rest/v1/rpc/get_os_settings'");
    expect(api).toContain("'/rest/v1/rpc/update_os_settings'");
    expect(api).toContain('expected_version');
    expect(api).not.toContain('organization_id:');
    expect(api).not.toContain('org_id:');
  });

  it('exposes a protected responsive settings route with truthful adapter status', () => {
    const resolver = source('apps/web/src/extensions/resolveAtlasExtension.tsx');
    const page = source('apps/web/src/modules/os/OsSettingsPage.tsx');
    const css = source('apps/web/src/modules/os/os-settings.css');
    expect(resolver).toContain("pathname === '/settings'");
    expect(resolver).toContain('<RequireAtlasIdentity>');
    expect(page).toContain('ATLAS OS Settings');
    expect(page).toContain('External delivery adapters');
    expect(page).toContain('Not verified');
    expect(page).toContain('Save personal settings');
    expect(page).toContain('Organization policy');
    expect(css).toContain('@media');
  });
});

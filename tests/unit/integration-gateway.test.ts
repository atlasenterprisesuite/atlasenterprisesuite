import { describe, expect, it } from 'vitest';
import * as core from '../../packages/core/src/index';

describe('ATLAS integration gateway permissions', () => {
  it('exposes a provider-neutral permission checker', () => {
    expect((core as Record<string, unknown>).hasIntegrationPermission).toBeTypeOf('function');
  });

  it('keeps Google Workspace permissions separate from accounting permissions', () => {
    const hasIntegrationPermission = (core as Record<string, unknown>)
      .hasIntegrationPermission as
      | ((granted: readonly string[], required: string) => boolean)
      | undefined;

    expect(hasIntegrationPermission).toBeTypeOf('function');
    expect(
      hasIntegrationPermission?.(['google.gmail.read'], 'google.gmail.read')
    ).toBe(true);
    expect(
      hasIntegrationPermission?.(['accounting.admin'], 'google.gmail.read')
    ).toBe(false);
  });
});

describe('ATLAS integration gateway connection model', () => {
  it('creates a tenant-scoped Google connection without exposing OAuth tokens', () => {
    const createIntegrationConnection = (core as Record<string, unknown>)
      .createIntegrationConnection as
      | ((input: {
          scope: { tenantId: string; organizationId: string };
          provider: string;
        }) => Record<string, unknown>)
      | undefined;

    expect(createIntegrationConnection).toBeTypeOf('function');

    const connection = createIntegrationConnection?.({
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
      provider: 'google'
    });

    expect(connection).toEqual({
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
      provider: 'google',
      status: 'disconnected'
    });
    expect(connection).not.toHaveProperty('accessToken');
    expect(connection).not.toHaveProperty('refreshToken');
  });

  it('builds a stable tenant-isolated connection key', () => {
    const integrationConnectionKey = (core as Record<string, unknown>)
      .integrationConnectionKey as
      | ((input: {
          scope: { tenantId: string; organizationId: string };
          provider: string;
        }) => string)
      | undefined;

    expect(integrationConnectionKey).toBeTypeOf('function');

    const first = integrationConnectionKey?.({
      scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
      provider: 'google'
    });
    const second = integrationConnectionKey?.({
      scope: { tenantId: 'tenant-b', organizationId: 'org-a' },
      provider: 'google'
    });

    expect(first).toBe('tenant-a:org-a:google');
    expect(second).toBe('tenant-b:org-a:google');
    expect(first).not.toBe(second);
  });
});

describe('ATLAS Google OAuth scope registry', () => {
  it('maps ATLAS permissions to narrow Google OAuth scopes and deduplicates them', () => {
    const googleOAuthScopesForPermissions = (core as Record<string, unknown>)
      .googleOAuthScopesForPermissions as
      | ((permissions: readonly string[]) => string[])
      | undefined;

    expect(googleOAuthScopesForPermissions).toBeTypeOf('function');

    expect(
      googleOAuthScopesForPermissions?.([
        'google.gmail.read',
        'google.gmail.read',
        'google.gmail.write',
        'google.calendar.read',
        'google.calendar.write',
        'google.drive.read',
        'google.drive.write'
      ])
    ).toEqual([
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
      'https://www.googleapis.com/auth/calendar.events.freebusy',
      'https://www.googleapis.com/auth/calendar.events.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file'
    ]);
  });

  it('does not turn ATLAS integration admin into blanket Google OAuth access', () => {
    const googleOAuthScopesForPermissions = (core as Record<string, unknown>)
      .googleOAuthScopesForPermissions as
      | ((permissions: readonly string[]) => string[])
      | undefined;

    expect(googleOAuthScopesForPermissions).toBeTypeOf('function');
    expect(googleOAuthScopesForPermissions?.(['integrations.admin'])).toEqual([]);
  });
});

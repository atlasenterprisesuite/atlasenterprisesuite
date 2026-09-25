import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';

const resolverPath = 'apps/web/src/extensions/resolveAtlasExtension.tsx';
const routesPath = 'apps/web/src/modules/connect/ConnectRoutes.tsx';
const homePath = 'apps/web/src/modules/connect/ConnectHomePage.tsx';
const wirelessPath = 'apps/web/src/modules/connect/AtlasWirelessPage.tsx';
const pagePath = 'apps/web/src/modules/connect/AtlasMvnoControlPage.tsx';
const browserTypesPath = 'apps/web/src/modules/connect/mvno/types.ts';
const serverContractPath = 'supabase/functions/_shared/mvno.ts';
const permissionsMigrationPath = 'supabase/migrations/20260925122500_atlas_mvno_permissions.sql';
const docsPath = 'docs/atlas-wireless/MVNO_CORE.md';

describe('ATLAS Wireless MVNO pilot core', () => {
  it('registers the governed MVNO pilot route behind the canonical identity guard', () => {
    const resolver = read(resolverPath);

    expect(read(routesPath)).toContain('path="/connect/wireless/mvno"');
    expect(read(homePath)).toContain('to="/connect/wireless/mvno"');
    expect(read(wirelessPath)).toContain('to="/connect/wireless/mvno"');
    expect(resolver).toContain("pathname === '/connect'");
    expect(resolver).toContain("pathname.startsWith('/connect/')");
    expect(resolver).toContain('<RequireAtlasIdentity><ConnectRoutes /></RequireAtlasIdentity>');
  });

  it('keeps pilot activation fail-closed until external carrier evidence exists', () => {
    const page = read(pagePath);
    const docs = read(docsPath);

    expect(page).toContain("FALLBACK_STATE = 'pending_provider'");
    expect(page).toContain('No mock, fixture or static UI state can satisfy activation');
    expect(page).not.toContain('Pilot state: active');
    expect(docs).toContain('No mock, static fixture, browser state, configured secret or UI action may move a subscriber into `active`');
    expect(docs).toContain('Production route reachability is not carrier readiness and MUST NOT promote provider or subscriber state');
    expect(docs).toContain('configuration alone produces `configured_unverified`, never `ready`');
    expect(docs).toMatch(/credentials must never be committed to source control/i);
  });

  it('keeps the carrier adapter contract server-only and tenant-aware', () => {
    const contract = read(serverContractPath);

    expect(existsSync(browserTypesPath)).toBe(false);
    expect(existsSync(serverContractPath)).toBe(true);
    for (const field of [
      'organizationId: string',
      'tenantId: string',
      'userId: string',
      'providerInstanceId: string',
      'correlationId: string',
      'idempotencyKey: string'
    ]) {
      expect(contract).toContain(field);
    }
    for (const method of ['readiness', 'provision', 'getSubscriber', 'activate', 'suspend', 'reconnect', 'revoke']) {
      expect(contract).toContain(`${method}(context: MvnoProviderContext`);
    }
  });

  it('defines provider readiness, EID/IMEI handling, RBAC and auditable mutation evidence', () => {
    const contract = read(serverContractPath);
    const permissions = read(permissionsMigrationPath);

    for (const state of ['not_configured', 'pending_provider', 'configured_unverified', 'ready', 'degraded', 'offline', 'disabled']) {
      expect(contract).toContain(`'${state}'`);
    }
    for (const capability of ['esim', 'voice', 'sms_mms', 'mobile_data', 'hotspot', 'number_management', 'usage_events', 'e911']) {
      expect(contract).toContain(`'${capability}'`);
    }
    for (const permission of [
      'wireless.mvno.read',
      'wireless.mvno.provision',
      'wireless.mvno.activate',
      'wireless.mvno.suspend',
      'wireless.mvno.reconnect',
      'wireless.mvno.revoke',
      'wireless.mvno.audit',
      'wireless.mvno.admin'
    ]) {
      expect(contract).toContain(`'${permission}'`);
      expect(permissions).toContain(`'${permission}'`);
    }

    expect(permissions).toContain('insert into public.identity_permissions');
    expect(permissions).toContain('insert into public.identity_role_permissions');
    expect(permissions).toContain("('owner', 'wireless.mvno.admin')");
    expect(permissions).toContain("('admin', 'wireless.mvno.admin')");
    expect(permissions).not.toContain("('member', 'wireless.mvno.activate')");
    expect(permissions).not.toContain("('member', 'wireless.mvno.reconnect')");
    expect(contract).toContain('imei?: string');
    expect(contract).toContain("evidence: MvnoProviderEvidence & { providerState: 'ready' }");
    expect(contract).toContain('providerRequestId?: string');
    expect(contract).toContain('mvno_active_without_ready_provider');
    expect(contract).toContain('MVNO_ALLOWED_TRANSITIONS');
    expect(contract).not.toMatch(/api[_-]?key|client[_-]?secret|bearer[_-]?token/i);
    expect(contract).not.toContain('activationCode');
    expect(contract).toContain('activationReference?: string');
  });
});

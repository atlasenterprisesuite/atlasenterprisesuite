import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildSupabaseAssuranceSnapshot,
  type SupabaseAssuranceInput
} from '../../supabase/functions/_shared/infrastructure-assurance';

const statusSourcePath = 'supabase/functions/atlas-infra-status/index.ts';
const sharedSourcePath = 'supabase/functions/_shared/infrastructure-assurance.ts';

function baseInput(overrides: Partial<SupabaseAssuranceInput> = {}): SupabaseAssuranceInput {
  return {
    providerId: 'supabase-prod',
    organizationId: 'org-1',
    environment: 'production',
    project: {
      configured: true,
      reachable: true,
      region: 'us-east-2'
    },
    resilience: {
      readReplicaPresent: false,
      automaticCrossRegionFailoverSupported: null,
      failoverRunbookVerified: false,
      pitrConfigured: false,
      restoreDrillVerified: false
    },
    networking: {
      privateLinkDatabase: null,
      apiPrivate: null,
      authPrivate: null,
      storagePrivate: null,
      realtimePrivate: null
    },
    compliance: {
      providerCertificationEvidence: false,
      atlasControlEvidence: false,
      sharedControlEvidence: false
    },
    probeFailures: [],
    ...overrides
  };
}

describe('ATLAS Supabase Infrastructure Assurance adapter', () => {
  it('defines a provider adapter and keeps desired, observed and verified states distinct', () => {
    const shared = readFileSync(sharedSourcePath, 'utf8');
    const statusSource = readFileSync(statusSourcePath, 'utf8');

    expect(shared).toContain('SupabaseProviderAdapter');
    expect(shared).toContain('desired');
    expect(shared).toContain('observed');
    expect(shared).toContain('verified');
    expect(statusSource).toContain('assurance');
  });

  it('does not turn a read replica into verified cross-region failover', () => {
    const snapshot = buildSupabaseAssuranceSnapshot(baseInput({
      resilience: {
        readReplicaPresent: true,
        automaticCrossRegionFailoverSupported: false,
        failoverRunbookVerified: false,
        pitrConfigured: false,
        restoreDrillVerified: false
      }
    }));

    expect(snapshot.domains.resilience.checks.read_replica_present.status).toBe('verified');
    expect(snapshot.domains.resilience.checks.failover_ready.status).not.toBe('verified');
    expect(snapshot.domains.resilience.checks.failover_ready.verified).toBeNull();
  });

  it('treats PITR configuration as backup-enabled but recovery-unverified without a restore drill', () => {
    const snapshot = buildSupabaseAssuranceSnapshot(baseInput({
      resilience: {
        readReplicaPresent: false,
        automaticCrossRegionFailoverSupported: null,
        failoverRunbookVerified: false,
        pitrConfigured: true,
        restoreDrillVerified: false
      }
    }));

    expect(snapshot.domains.resilience.checks.backup_enabled.status).toBe('verified');
    expect(snapshot.domains.resilience.checks.recovery_verified.status).toBe('unverified');
  });

  it('keeps PrivateLink coverage scoped to the database path', () => {
    const snapshot = buildSupabaseAssuranceSnapshot(baseInput({
      networking: {
        privateLinkDatabase: true,
        apiPrivate: false,
        authPrivate: false,
        storagePrivate: false,
        realtimePrivate: false
      }
    }));

    expect(snapshot.domains.networking.paths.database.status).toBe('verified');
    expect(snapshot.domains.networking.paths.api.status).toBe('unverified');
    expect(snapshot.domains.networking.paths.auth.status).toBe('unverified');
    expect(snapshot.domains.networking.paths.storage.status).toBe('unverified');
    expect(snapshot.domains.networking.paths.realtime.status).toBe('unverified');
  });

  it('does not convert provider certification alone into verified ATLAS compliance', () => {
    const snapshot = buildSupabaseAssuranceSnapshot(baseInput({
      compliance: {
        providerCertificationEvidence: true,
        atlasControlEvidence: false,
        sharedControlEvidence: false
      }
    }));

    expect(snapshot.domains.compliance.status).toBe('partially_verified');
    expect(snapshot.domains.compliance.verified).toBeNull();
  });

  it('degrades a failed provider probe without hiding independent domains', () => {
    const snapshot = buildSupabaseAssuranceSnapshot(baseInput({
      project: {
        configured: true,
        reachable: false,
        region: null
      },
      networking: {
        privateLinkDatabase: true,
        apiPrivate: null,
        authPrivate: null,
        storagePrivate: null,
        realtimePrivate: null
      },
      probeFailures: ['project_unreachable']
    }));

    expect(snapshot.domains.readiness.status).toBe('degraded');
    expect(snapshot.domains.readiness.verified).toBeNull();
    expect(snapshot.domains.networking).toBeDefined();
    expect(snapshot.domains.resilience).toBeDefined();
    expect(snapshot.probe_failures).toEqual(['project_unreachable']);
  });
});

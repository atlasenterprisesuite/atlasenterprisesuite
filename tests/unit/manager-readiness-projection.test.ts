import { describe, expect, it } from 'vitest';
import {
  normalizeManagerInfraStatus,
  projectManagerReadiness,
  REQUIRED_MANAGER_STEPS
} from '../../supabase/functions/atlas-execution/manager-readiness';

function status(overrides: Record<string, string> = {}, vercelState = 'optional_provider_unconfigured') {
  return {
    ok: true,
    scope: { organization_id: 'org-1' },
    provider_status: {
      github: { state: overrides.github || 'ready', required: true },
      supabase: { state: overrides.supabase || 'ready', required: true },
      cloudflare: { state: overrides.cloudflare || 'ready', required: true },
      production: { state: overrides.production || 'ready', required: true },
      vercel: { state: vercelState, required: false }
    },
    blockers: Object.entries(overrides).filter(([, state]) => state !== 'ready').map(([stage, state]) => ({
      stage, code: state, detail: `${stage} is not ready`
    }))
  };
}

describe('Manager readiness projection', () => {
  it('projects a required provider failure as blocked', () => {
    const projected = projectManagerReadiness(normalizeManagerInfraStatus(status({ cloudflare: 'authorization_error' })));
    expect(projected.taskStatus).toBe('blocked');
    expect(projected.steps.find((step) => step.key === 'cloudflare')?.status).toBe('blocked');
    expect(projected.blockedReason).toBe('authorization_error');
  });

  it('accepts required providers when legacy snapshots rely on provider_requirements', () => {
    const legacy = status();
    legacy.provider_requirements = {
      github: true,
      supabase: true,
      cloudflare: true,
      production: true,
      vercel: false
    };
    delete legacy.provider_status.github.required;
    delete legacy.provider_status.supabase.required;
    delete legacy.provider_status.cloudflare.required;
    delete legacy.provider_status.production.required;

    const projected = projectManagerReadiness(normalizeManagerInfraStatus(legacy));
    expect(projected.allRequiredReady).toBe(true);
  });

  it('accepts optional GitHub in the active direct-deploy contract without weakening required providers', () => {
    const directDeploy = status();
    directDeploy.provider_requirements = {
      github: false,
      supabase: true,
      cloudflare: true,
      production: true,
      vercel: false
    };
    directDeploy.provider_status.github = {
      state: 'optional_provider_unconfigured',
      required: false
    };

    const projected = projectManagerReadiness(normalizeManagerInfraStatus(directDeploy));
    const github = projected.steps.find((step) => step.key === 'github');

    expect(projected.allRequiredReady).toBe(true);
    expect(github?.required).toBe(false);
    expect(github?.status).toBe('completed');
    expect(github?.providerState).toBe('optional_provider_unconfigured');
  });

  it('rejects a malformed required provider contract', () => {
    expect(() => normalizeManagerInfraStatus({ ok: true, provider_status: {} })).toThrow('infra_status_contract_invalid');
    expect(() => normalizeManagerInfraStatus({
      ok: true,
      provider_requirements: { github: true, supabase: true, cloudflare: true, production: true },
      provider_status: {
        github: { state: 'ready', required: false },
        supabase: { state: 'ready' },
        cloudflare: { state: 'ready' },
        production: { state: 'ready' }
      }
    })).toThrow('infra_status_contract_invalid');
  });

  it('uses four provider-specific evidence kinds', () => {
    expect(REQUIRED_MANAGER_STEPS.map((step) => step.evidenceKind)).toEqual([
      'infra_verification.github',
      'infra_verification.supabase',
      'infra_verification.cloudflare',
      'infra_verification.production'
    ]);
  });

  it('does not let optional Vercel block required-path eligibility', () => {
    const projected = projectManagerReadiness(normalizeManagerInfraStatus(status({}, 'optional_provider_unconfigured')));
    expect(projected.taskStatus).toBe('completed');
    expect(projected.allRequiredReady).toBe(true);
  });

  it('keeps a required production outage blocked', () => {
    const projected = projectManagerReadiness(normalizeManagerInfraStatus(status({ production: 'public_site_unreachable' })));
    expect(projected.taskStatus).toBe('blocked');
    expect(projected.steps.find((step) => step.key === 'production')?.status).toBe('blocked');
  });
});

import { describe, expect, it } from 'vitest';
import * as readiness from '../../supabase/functions/_shared/infrastructure-readiness';

const { evaluateInfrastructure } = readiness;

describe('ATLAS Manager infrastructure readiness', () => {
  it('does not block when optional Vercel is unconfigured', () => {
    const result = evaluateInfrastructure({
      github: { state: 'ready', required: true },
      supabase: { state: 'ready', required: true },
      cloudflare: { state: 'ready', required: true },
      production: { state: 'ready', required: true },
      vercel: { state: 'not_configured', required: false }
    });

    expect(result.status).toBe('ready');
    expect(result.blockers).toEqual([]);
    expect(result.providers.vercel.state).toBe('optional_provider_unconfigured');
    expect(result.requiredPath).toEqual(['github', 'supabase', 'cloudflare', 'production']);
  });

  it('blocks when required Cloudflare is not verified', () => {
    const result = evaluateInfrastructure({
      github: { state: 'ready', required: true },
      supabase: { state: 'ready', required: true },
      cloudflare: { state: 'not_verified', required: true },
      production: { state: 'ready', required: true },
      vercel: { state: 'not_configured', required: false }
    });

    expect(result.status).toBe('partial');
    expect(result.blockers).toEqual([
      {
        provider: 'cloudflare',
        reason: 'not_verified',
        nextAction: 'verify_or_repair_cloudflare'
      }
    ]);
  });

  it('blocks on Vercel only when a release explicitly makes it required', () => {
    const result = evaluateInfrastructure({
      github: { state: 'ready', required: true },
      supabase: { state: 'ready', required: true },
      cloudflare: { state: 'ready', required: true },
      production: { state: 'ready', required: true },
      vercel: { state: 'not_configured', required: true }
    });

    expect(result.status).toBe('partial');
    expect(result.blockers[0]).toEqual({
      provider: 'vercel',
      reason: 'not_configured',
      nextAction: 'verify_or_repair_vercel'
    });
    expect(result.requiredPath).toEqual(['github', 'supabase', 'cloudflare', 'production', 'vercel']);
  });

  it('keeps optional provider failures visible without promoting them to blockers', () => {
    const result = evaluateInfrastructure({
      github: { state: 'ready', required: true },
      supabase: { state: 'ready', required: true },
      cloudflare: { state: 'ready', required: true },
      production: { state: 'ready', required: true },
      vercel: { state: 'authorization_error', required: false }
    });

    expect(result.status).toBe('ready');
    expect(result.blockers).toEqual([]);
    expect(result.providers.vercel.state).toBe('authorization_error');
  });

  it('classifies a dashboard-only Cloudflare incident as provider-side without blocking healthy ATLAS production', () => {
    const result = evaluateInfrastructure({
      github: { state: 'ready', required: true },
      supabase: { state: 'ready', required: true },
      cloudflare: {
        state: 'ready',
        required: true,
        incident: {
          source: 'cloudflare_status',
          active: true,
          scope: 'dashboard',
          impact: 'minor',
          name: 'Intermittent issues accessing the Dashboard on Firefox and Safari'
        }
      },
      production: { state: 'ready', required: true },
      vercel: { state: 'not_configured', required: false }
    } as any);

    expect(result.status).toBe('ready');
    expect(result.blockers).toEqual([]);
    expect((result as any).diagnostics).toContainEqual({
      provider: 'cloudflare',
      cause: 'provider',
      scope: 'dashboard',
      blocking: false,
      summary: 'Cloudflare has an active dashboard incident, but ATLAS production is reachable.'
    });
  });

  it('attributes a production outage to Cloudflare when an active edge incident overlaps it', () => {
    const result = evaluateInfrastructure({
      github: { state: 'ready', required: true },
      supabase: { state: 'ready', required: true },
      cloudflare: {
        state: 'ready',
        required: true,
        incident: {
          source: 'cloudflare_status',
          active: true,
          scope: 'edge',
          impact: 'major',
          name: 'Network connectivity issues'
        }
      },
      production: { state: 'public_site_unreachable', required: true },
      vercel: { state: 'not_configured', required: false }
    });

    expect(result.status).toBe('partial');
    expect(result.diagnostics).toContainEqual({
      provider: 'cloudflare',
      cause: 'provider',
      scope: 'edge',
      blocking: true,
      summary: 'ATLAS production is unreachable while Cloudflare reports an active edge incident.'
    });
  });

  it('does not blame Cloudflare for an ATLAS production outage when no provider incident is active', () => {
    const result = evaluateInfrastructure({
      github: { state: 'ready', required: true },
      supabase: { state: 'ready', required: true },
      cloudflare: { state: 'ready', required: true },
      production: { state: 'public_site_unreachable', required: true },
      vercel: { state: 'not_configured', required: false }
    });

    expect(result.status).toBe('partial');
    expect(result.diagnostics).toContainEqual({
      provider: 'production',
      cause: 'atlas_or_unknown',
      scope: 'production',
      blocking: true,
      summary: 'ATLAS production is unreachable and no matching Cloudflare provider incident is active.'
    });
  });

  it('classifies Cloudflare incident scope from incident and component names', () => {
    const classify = (readiness as any).classifyCloudflareIncidentScope;

    expect(classify?.(['Intermittent issues accessing the Dashboard on Firefox and Safari'])).toBe(
      'dashboard'
    );
    expect(classify?.(['Cloudflare Workers', 'CDN/Cache', 'Network connectivity issues'])).toBe(
      'edge'
    );
    expect(classify?.(['Cloudflare Dashboard', 'Workers'])).toBe('mixed');
    expect(classify?.(['Investigating an issue with a third-party dependency'])).toBe('unknown');
  });
});

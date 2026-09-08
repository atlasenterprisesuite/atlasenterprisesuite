import { describe, expect, it } from 'vitest';
import { evaluateInfrastructure } from '../../supabase/functions/_shared/infrastructure-readiness';

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
});

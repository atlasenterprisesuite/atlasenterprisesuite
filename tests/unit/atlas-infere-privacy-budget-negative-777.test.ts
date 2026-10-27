import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createIntelligenceRouter } from '../../supabase/functions/atlas-copilot/intelligence-gateway.mjs';

const sql = readFileSync('supabase/migrations/20260920160000_atlas_ai_emergency_fallback_budget.sql', 'utf8');
const ready = (id: string) => ({
  id, configured: true, verified: true,
  capabilities: ['generation'], profiles: ['balanced'],
});

describe('ATLAS Infere security contract — RED tests, not yet certified', () => {
  it('requires a declared privacy clearance before selecting cross-provider fallback', () => {
    const router = createIntelligenceRouter({
      providers: [ready('atlas-local'), ready('openai')],
      preferredProviders: ['atlas-local'],
    });
    const route = router.route({ mode: 'auto', intent: 'balanced', capabilities_requested: ['generation'] });
    // This test is intentionally RED until a tenant-specific privacy gate exists.
    // An unclassified request must never make a remote provider eligible.
    expect(route.fallback_providers).not.toContain('openai');
  });

  it('uses UTC date for both the reservation lock and its budget period', () => {
    // This fails on a lock keyed by current_date, which depends on session timezone.
    expect(sql).not.toMatch(/current_date::text/i);
    expect(sql).toMatch(/timezone\('UTC',\s*now\(\)\)/i);
  });

  it('rejects idempotency replay that changes reserved dollar amount', () => {
    // Existing trace reservations must not be accepted with different terms.
    expect(sql).toMatch(/v_existing\.reserve_usd\s*(?:<>|!=|IS DISTINCT FROM)\s*p_reserve_usd/i);
  });

  it('binds privileged budget operations to verified actor membership', () => {
    // RPC input p_actor_id alone does not establish authorization.
    expect(sql).toMatch(/organization_members|has_identity_permission|authorize_action/i);
  });
});

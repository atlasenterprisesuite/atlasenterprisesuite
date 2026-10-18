import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readinessWorkflow = readFileSync('.github/workflows/production-deploy.yml', 'utf8');
const cloudflareWorkflow = readFileSync('.github/workflows/cloudflare-deploy.yml', 'utf8');

describe('ATLAS Copilot release synchronization', () => {
  it('requires a monotonic Copilot version bump whenever Copilot source changes', () => {
    expect(readinessWorkflow).toContain('Require ATLAS Copilot version bump when source changes');
    expect(readinessWorkflow).toContain('supabase/functions/atlas-copilot/');
    expect(readinessWorkflow).toContain('github.event.pull_request.base.sha');
    expect(readinessWorkflow).toContain('github.event.before');
    expect(readinessWorkflow).toContain('BASE_VERSION');
    expect(readinessWorkflow).toContain('HEAD_VERSION');
    expect(readinessWorkflow).toContain('ATLAS Copilot source changed without a monotonic VERSION bump');
  });

  it('fails closed before Cloudflare deploy when live Copilot does not match repository contract', () => {
    expect(cloudflareWorkflow).toContain('Verify ATLAS Copilot live release contract');
    expect(cloudflareWorkflow).toContain(
      'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-copilot?api=readiness'
    );
    expect(cloudflareWorkflow).toContain('EXPECTED_VERSION');
    expect(cloudflareWorkflow).toContain('LIVE_VERSION');
    expect(cloudflareWorkflow).toContain('EXPECTED_PROVIDERS');
    expect(cloudflareWorkflow).toContain('LIVE_PROVIDERS');
    expect(cloudflareWorkflow).toContain('EXPECTED_MODES');
    expect(cloudflareWorkflow).toContain('LIVE_MODES');
    expect(cloudflareWorkflow).toContain('ATLAS Copilot live version does not match repository VERSION');
    expect(cloudflareWorkflow).toContain('ATLAS Copilot live provider catalog does not match repository contract');
    expect(cloudflareWorkflow).toContain('ATLAS Copilot live mode catalog does not match repository contract');
  });
});

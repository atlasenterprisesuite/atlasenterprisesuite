import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wrangler = readFileSync('wrangler.jsonc', 'utf8');
const workflow = readFileSync('.github/workflows/cloudflare-deploy.yml', 'utf8');

describe('Cloudflare Workers Static Assets deployment contract', () => {
  it('serves the Vite SPA build as Workers static assets', () => {
    expect(wrangler).toContain('"name": "atlas-enterprise-suite-web"');
    expect(wrangler).toContain('"directory": "./apps/web/dist"');
    expect(wrangler).toContain('"not_found_handling": "single-page-application"');
  });

  it('deploys only after the repository validation gates', () => {
    expect(workflow).toContain('npm run typecheck');
    expect(workflow).toContain('npm run test:unit');
    expect(workflow).toContain('npm run test:integration');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('wrangler@4 deploy');
  });

  it('keeps custom-domain cutover separate from the initial worker deploy', () => {
    expect(wrangler).not.toContain('custom_domain');
    expect(workflow).toContain('workers.dev');
  });
});

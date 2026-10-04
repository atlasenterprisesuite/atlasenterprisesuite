import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const dataPath = 'apps/web/src/modules/knowledge/bible/bibleOsData.ts';
const pagePath = 'apps/web/src/modules/knowledge/bible/BibleOSPage.tsx';
const cssPath = 'apps/web/src/modules/knowledge/bible/BibleOSPage.css';
const contractPath = 'data/ops/global-production-verification.json';
const authorizedVerifierPath = 'supabase/functions/atlas-cloudflare-production-http-verify/index.ts';
const cloudflareWorkflowPath = '.github/workflows/cloudflare-deploy.yml';
const globalWorkflowPath = '.github/workflows/global-production-verify.yml';

describe('ATLAS Bible OS post-review hardening', () => {
  it('keeps canon evidence source-first instead of rendering unsupported historical badges', () => {
    const data = read(dataPath);
    const page = read(pagePath);

    expect(data).toContain('sourceIds: string[];');
    expect(data).toContain("sourceIds: ['canon-formation-reference']");
    expect(page).toContain('<SourceLinks sourceIds={profile.sourceIds} />');
  });

  it('uses the approved relationship taxonomy and required audit provenance fields', () => {
    const data = read(dataPath);

    for (const relation of ['MANUSCRIPT_VARIANT_OF', 'CANON_INCLUDES', 'CANON_EXCLUDES', 'ATTESTED_BY']) {
      expect(data).toContain(`'${relation}'`);
    }
    expect(data).not.toContain("'CATALOGED_BY'");
    expect(data).not.toContain("'VARIANT_OF'");
    expect(data).toContain('relationMethod: string;');
    expect(data).toContain('creatorImporter: string;');
    expect(data).toContain('createdAt: string;');
    expect(data).toContain('verifiedAt: string;');
    expect(data).toContain("verificationStatus: 'verified' | 'probable' | 'possible' | 'disputed' | 'unverified';");
  });

  it('represents the approved minimum manuscript provenance fields', () => {
    const data = read(dataPath);
    for (const field of [
      'catalogIdentifiers: string[];',
      'repository: string;',
      'provenanceHistory: string;',
      'digitizationUrl: string;',
      'transcriptionSource: string;',
      'preservedPassages: string;',
      'lacunae: string;',
      'corrections: string;',
      'bibliography: string[];',
      'rightsLicense: string;'
    ]) {
      expect(data).toContain(field);
    }
  });

  it('visually distinguishes the selected Bible OS view without relying on aria alone', () => {
    const page = read(pagePath);
    const css = read(cssPath);
    expect(existsSync(cssPath)).toBe(true);
    expect(page).toContain("import './BibleOSPage.css';");
    expect(page).toContain("className={`execution-action bible-os-view-button${view === item.id ? ' is-active' : ''}`}");
    expect(css).toContain('.bible-os-view-button.is-active');
  });

  it('versions the changed production contracts and aligns both workflows with verifier version 32', () => {
    const contract = JSON.parse(read(contractPath)) as { version?: number };
    const verifier = read(authorizedVerifierPath);
    const cloudflareWorkflow = read(cloudflareWorkflowPath);
    const globalWorkflow = read(globalWorkflowPath);

    expect(contract.version).toBe(31);
    expect(verifier).toContain('const VERSION = 32;');
    expect(cloudflareWorkflow).toContain('[ "$AUTHORIZED_VERIFIER_VERSION" = "32" ]');
    expect(globalWorkflow).toContain('[ "$AUTHORIZED_VERIFIER_VERSION" = "32" ]');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const api = readFileSync('apps/web/src/modules/health/bioscan/bioscanApi.ts', 'utf8');
const repository = readFileSync('apps/web/src/modules/health/bioscan/bioscanRepository.ts', 'utf8');
const surface = `${api}\n${repository}`;

describe('ATLAS BioScan browser data boundary', () => {
  it('reuses the canonical ATLAS authenticated organization/session boundary', () => {
    expect(api).toContain('getActiveAtlasOrganization');
    expect(api).toContain('authorizedAtlasFetch');
    expect(api).toContain("'/functions/v1/atlas-platform-controls?api='");
    expect(api).toContain("'x-atlas-org-id'");
  });

  it('never mutates sensitive BioScan tables directly from the browser', () => {
    expect(surface).not.toContain("method: 'POST',\n      body: JSON.stringify");
    expect(surface).not.toMatch(/\/rest\/v1\/(bioscan_|human_twin|body_measurements|sensor_observations|posture_observations)/);
    expect(api).toContain('callBioScanControlPlane');
  });

  it('does not serialize raw media types or image payloads', () => {
    expect(surface).not.toContain('FileReader');
    expect(surface).not.toContain('readAsDataURL');
    expect(surface).not.toContain('canvas.toDataURL');
    expect(surface).not.toContain('MediaRecorder');
    expect(surface).not.toContain('FormData');
  });

  it('propagates non-success status and malformed-response failures explicitly', () => {
    expect(api).toContain('bioscan_http_');
    expect(api).toContain('bioscan_invalid_response');
    expect(api).toContain('response.status');
  });

  it('preserves source summaries and confidence metadata in the UI view model', () => {
    expect(repository).toContain('sourceSummary');
    expect(repository).toContain('confidenceSummary');
    expect(repository).toContain('captureMode');
    expect(repository).toContain('capturedAt');
  });
});
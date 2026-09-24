import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registry = readFileSync('apps/web/src/modules/registry.ts','utf8');
const file = (path: string) => readFileSync(path,'utf8');

function readiness(id: string) {
  const start = registry.indexOf(`id: '${id}'`);
  expect(start, `missing module ${id}`).toBeGreaterThanOrEqual(0);
  const end = registry.indexOf('\n  {', start + 1);
  const block = registry.slice(start, end === -1 ? registry.length : end);
  return block.match(/readiness: '([^']+)'/)?.[1] || '';
}

describe('ATLAS A-Z mature module readiness', () => {
  it.each(['knowledge','advisory','tax','learning','health','events','frontier','aviation','release-control'])
    ('%s is implemented within its declared product scope', (id) => expect(readiness(id)).toBe('implemented'));

  it.each(['commerce','insurance','voice','hospitality','device-os'])
    ('%s truthfully remains external-gated', (id) => expect(readiness(id)).toBe('external-gated'));

  it('Knowledge is persisted, approval-governed organizational memory', () => {
    const page=file('apps/web/src/modules/knowledge/KnowledgeAtlasPage.tsx');
    const api=file('apps/web/src/modules/knowledge/memoryApi.ts');
    expect(page).toContain('Save draft');
    expect(page).toContain('Approve memory');
    expect(page).toContain('Personal conversations are not ingested automatically');
    expect(api).toContain('/functions/v1/atlas-memory');
  });

  it('Learning and Health preserve non-clinical boundaries', () => {
    expect(file('apps/web/src/modules/experience/LearningExperiencePage.tsx')).toContain('does not diagnose');
    expect(file('apps/web/src/modules/experience/HealthExperiencePage.tsx')).toContain('No EHR, FHIR, HL7 or patient workflow is represented as connected');
  });

  it('external-gated modules explicitly refuse fabricated provider or hardware state', () => {
    expect(file('apps/web/src/modules/insurance/InsuranceHome.tsx')).toContain('does not invent policy');
    expect(file('apps/web/src/modules/voice/VoiceHomePage.tsx')).toContain('true local wake word belongs in the native ATLAS device client');
    expect(file('apps/web/src/modules/hospitality/HospitalityOverviewPage.tsx')).toContain('payments are not presented as live yet');
    const deviceOs=file('apps/web/src/modules/device-os/DeviceOSPage.tsx');
    expect(deviceOs).toContain('never reported as connected unless a');
    expect(deviceOs).toContain('real adapter is available');
  });
});

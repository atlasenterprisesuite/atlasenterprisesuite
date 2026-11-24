import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('apps/web/src/modules/knowledge/plants/GlobalPlantAtlasPage.tsx', 'utf8');
const resolver = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const knowledge = readFileSync('apps/web/src/modules/knowledge/KnowledgeAtlasPage.tsx', 'utf8');
const docs = readFileSync('docs/knowledge/global-plant-atlas/README.md', 'utf8');

describe('ATLAS Global Plant Atlas RUN contract', () => {
  it('routes the Plant Atlas through governed Knowledge identity scope', () => {
    expect(resolver).toContain("pathname === '/knowledge/plants'");
    expect(resolver).toContain('<RequireAtlasIdentity><GlobalPlantAtlasPage /></RequireAtlasIdentity>');
    expect(knowledge).toContain('to="/knowledge/plants"');
  });

  it('uses the existing ATLAS Work workflow instead of a parallel executor', () => {
    expect(page).toContain("createWorkWorkflow");
    expect(page).toContain("ownerModule: 'knowledge'");
    expect(page).toContain("executionMode: 'hybrid'");
    expect(page).toContain("autonomyLevel: 'autonomous'");
    expect(page).toContain('budgetLimit: 0');
    expect(page).toContain("connectionRefs: []");
    expect(page).toContain("navigate(\`/execution/\${encodeURIComponent(result.workflowId)}\`)");
  });

  it('exposes an explicit RUN control and keeps scientific safety boundaries visible', () => {
    expect(page).toContain("{running ? 'RUNNING…' : 'RUN'}");
    expect(page).toContain('Fail closed');
    expect(page).toContain('Human–Plant Relationship Graph');
    expect(docs).toContain('unknown/not assessed');
    expect(docs).toContain('traditional use');
  });
});

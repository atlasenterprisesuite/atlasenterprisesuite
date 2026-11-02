import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const page = readFileSync('apps/web/src/modules/security/VisualApprovalsPage.tsx','utf8');
const app = readFileSync('apps/web/src/App.tsx','utf8');
describe('ATLAS visual approvals 777 safety contract', () => {
 it('requires identity on the visual review route', () => expect(app).toContain('path="/security/visual-approvals" element={<RequireAtlasIdentity><VisualApprovalsPage /></RequireAtlasIdentity>}'));
 it('keeps approval disabled and has no mutation calls', () => {expect(page).toContain('disabled aria-disabled="true"');expect(page).not.toMatch(/fetch\(|axios\.|mergePullRequest|deployWorkflow|supabase\.from/);});
 it('shows exact source SHA and synthetic-data disclaimer', () => {expect(page).toContain('7540f79486811d13d1671a735a303b03923441f5');expect(page).toContain('escenarios sintéticos');});
 it('keeps missing answers blocked and P0 review mandatory', () => {expect(page).toContain("s.priority === 'P0'");expect(page).toContain("s.tenant === 'No' && s.security === 'No' && s.production === 'No'");expect(page).toContain("s.inferred");});
 it('offers before and after comparison without pretending to be live', () => {expect(page).toContain('Antes · intake legacy');expect(page).toContain('Después · PR #914');expect(page).toContain('no consulta GitHub en tiempo real');});
});

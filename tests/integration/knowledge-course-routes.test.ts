import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const resolver = readFileSync(root + '/apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const studio = readFileSync(root + '/apps/web/src/modules/knowledge/KnowledgeCourseStudioPage.tsx', 'utf8');
const library = readFileSync(root + '/apps/web/src/modules/knowledge/LearningCourseLibraryPage.tsx', 'utf8');
const knowledge = readFileSync(root + '/apps/web/src/modules/knowledge/KnowledgeAtlasPage.tsx', 'utf8');
const learning = readFileSync(root + '/apps/web/src/modules/experience/LearningExperiencePage.tsx', 'utf8');

describe('Knowledge Atlas Course Forge integration', () => {
  it('mounts protected Course Forge and approved Learning course routes', () => {
    expect(resolver).toContain("pathname === '/knowledge/course-studio'");
    expect(resolver).toContain("pathname === '/learning/courses'");
    expect(resolver).toContain('<RequireAtlasIdentity><KnowledgeCourseStudioPage /></RequireAtlasIdentity>');
    expect(resolver).toContain('<RequireAtlasIdentity><LearningCourseLibraryPage /></RequireAtlasIdentity>');
  });

  it('reuses governed Assistant and ATLAS Memory instead of creating a parallel store', () => {
    expect(studio).toContain('sendAssistantWorkspaceMessage');
    expect(studio).toContain('createAtlasMemoryDraft');
    expect(studio).toContain('approveAtlasMemory');
    expect(studio).toContain("moduleIds: ['knowledge','learning']");
    expect(studio).toContain("tags: ['atlas-course'");
  });

  it('keeps restricted Knowledge fail-closed and preserves selected source provenance', () => {
    expect(studio).toContain("record.sensitivity === 'restricted'");
    expect(studio).toContain('verified local/sovereign data-policy gate');
    expect(studio).toContain('selectedSourceIds.slice(0, 20)');
    expect(studio).toContain('source:${id}');
  });

  it('keeps publication explicit and approved-only', () => {
    expect(library).toContain("status: 'approved'");
    expect(library).toContain("record.tags.includes('atlas-course')");
    expect(studio).toContain('Save + explicitly approve for Learning');
    expect(studio).not.toContain('automatically approve');
  });

  it('surfaces Course Forge from both Knowledge and Learning', () => {
    expect(knowledge).toContain('/knowledge/course-studio');
    expect(knowledge).toContain('/learning/courses');
    expect(learning).toContain('/knowledge/course-studio');
    expect(learning).toContain('/learning/courses');
  });
});

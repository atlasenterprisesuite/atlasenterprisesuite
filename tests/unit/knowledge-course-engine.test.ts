import { describe, expect, it } from 'vitest';
import { buildCourseGenerationPrompt, courseToMarkdown, parseGeneratedCourse } from '../../apps/web/src/modules/knowledge/courseEngine';

const fixture = JSON.stringify({
  schemaVersion: 'atlas-course-v1',
  title: 'Practical Accounting',
  description: 'Applied accounting course.',
  language: 'English',
  level: 'Introductory',
  targetAudience: 'New accountants',
  prerequisites: [],
  learningOutcomes: ['Post a journal entry'],
  estimatedHours: 4,
  modules: [{
    title: 'Foundations',
    objective: 'Build the accounting cycle.',
    lessons: [{
      title: 'Journal entries',
      objective: 'Record a transaction.',
      estimatedMinutes: 45,
      instructorScript: 'Today we will record a transaction from source evidence.',
      workedExample: 'Debit cash and credit revenue when appropriate.',
      learnerActivity: 'Classify five transactions.',
      questions: [{
        question: 'What is the first source of truth?',
        type: 'short_answer',
        options: [],
        answer: 'The supporting transaction evidence.',
        explanation: 'Evidence precedes posting.'
      }]
    }]
  }],
  finalProject: { title: 'Close a mini-ledger', brief: 'Complete the cycle.', deliverables: ['Ledger'] },
  assessment: { passingScore: 80, rubric: [{ criterion: 'Accuracy', weight: 100, evidence: 'Correct entries' }] },
  instructorGuide: { openingScript: 'Welcome.', facilitationNotes: ['Use real-life examples.'], closingScript: 'Review the evidence.' },
  distributionChecklist: ['Verify sources'],
  sourceBoundary: 'Verify material facts.'
});

describe('ATLAS Course Forge engine', () => {
  it('parses a complete course package and preserves instructor scripts', () => {
    const course = parseGeneratedCourse(fixture);
    expect(course.schemaVersion).toBe('atlas-course-v1');
    expect(course.modules[0].lessons[0].instructorScript).toContain('record a transaction');
    expect(course.assessment.passingScore).toBe(80);
  });

  it('accepts fenced provider JSON without trusting surrounding prose', () => {
    const course = parseGeneratedCourse(['```json', fixture, '```'].join('\n'));
    expect(course.title).toBe('Practical Accounting');
  });

  it('requires at least one teachable lesson', () => {
    expect(() => parseGeneratedCourse(JSON.stringify({ title: 'Empty', modules: [] }))).toThrow('course_lessons_missing');
  });

  it('requests full teaching scripts, practical work and JSON-only output', () => {
    const prompt = buildCourseGenerationPrompt({
      topic: 'Tax',
      audience: 'Preparers',
      goal: 'Prepare a return',
      language: 'English',
      level: 'Practical',
      durationHours: 8,
      sourceMaterial: 'Authorized source'
    });
    expect(prompt).toContain('full instructorScript');
    expect(prompt).toContain('practical scenarios');
    expect(prompt).toContain('Return ONLY valid JSON');
    expect(prompt).toContain('Authorized source');
  });

  it('exports an instructor-ready Markdown package', () => {
    const markdown = courseToMarkdown(parseGeneratedCourse(fixture));
    expect(markdown).toContain('# Practical Accounting');
    expect(markdown).toContain('#### Instructor script');
    expect(markdown).toContain('## Final applied project');
    expect(markdown).toContain('## Distribution checklist');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const apiSource = readFileSync('apps/web/src/execution/api.ts', 'utf8');
const pageSource = readFileSync('apps/web/src/execution/GuidedExecutionPage.tsx', 'utf8');
const actionBarSource = readFileSync('apps/web/src/execution/StepActionBar.tsx', 'utf8');

describe('Guided Work execute/resume wiring', () => {
  it('exposes server-backed execute and resume operations', () => {
    expect(apiSource).toContain("operation: 'execute_work_step'");
    expect(apiSource).toContain("operation: 'resume_work_step'");
  });

  it('routes execute and resume actions through explicit page handlers', () => {
    expect(pageSource).toContain('executeWorkStep');
    expect(pageSource).toContain('resumeWorkStep');
    expect(pageSource).toContain('onExecuteStep');
    expect(pageSource).toContain('onResumeStep');
  });

  it('does not treat execute or resume as evidence navigation', () => {
    expect(actionBarSource).toContain("action.kind === 'execute'");
    expect(actionBarSource).toContain("action.kind === 'resume'");
    expect(actionBarSource).toContain('onExecuteStep');
    expect(actionBarSource).toContain('onResumeStep');
  });
});

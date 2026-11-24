import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, stat, chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createLocalJobStore } from '../../scripts/atlas-777/local-job-store.mjs';
import { planDigest, runLocalCycle } from '../../scripts/atlas-777/local-cycle.mjs';
import { enqueue, claim } from '../../apps/web/src/lib/atlas777Executor';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'atlas-777-resume-'));
  const root = join(dir, 'repository'); await mkdir(root);
  git(root, 'init', '-b', 'feat/resume-pilot');
  git(root, 'config', 'user.name', 'ATLAS synthetic fixture');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  await mkdir(join(root, 'packages/pilot'), { recursive: true });
  await mkdir(join(root, 'tests'), { recursive: true });
  const before = 'export const answer = () => 0;\n';
  const after = 'export const answer = () => 42;\n';
  const test = "import assert from 'node:assert/strict';\nimport {answer} from '../packages/pilot/answer.mjs';\nassert.equal(answer(), 42);\n";
  await writeFile(join(root, 'packages/pilot/answer.mjs'), before);
  await writeFile(join(root, 'tests/pilot.test.mjs'), test);
  git(root, 'add', '.'); git(root, 'commit', '-m', 'synthetic baseline');
  const plan = { version: 1, id: 'pilot', sourceEventId: 'synthetic-consented-task',
    organizationId: 'synthetic-org', repository: 'atlasenterprisesuite/atlasenterprisesuite',
    baseSha: git(root, 'rev-parse', 'HEAD'), branch: 'feat/resume-pilot',
    change: { path: 'packages/pilot/answer.mjs', beforeSha256: hash(before), content: after },
    test: { path: 'tests/pilot.test.mjs', sha256: hash(test) } };
  const stateDirectory = join(dir, 'state');
  return { dir, root, stateDirectory, plan, before, after,
    options: { repositoryRoot: root, stateDirectory, plan, approvedDigest: planDigest(plan), maxJobs: 1 } };
}

describe.skipIf(process.platform === 'win32')('ATLAS 777 resumable local implementation pilot (POSIX)', () => {
  it.each(['source', 'acceptance test'])('rejects a group-writable %s before claiming or editing', async kind => {
    const f = await fixture();
    try {
      await chmod(join(f.root, kind === 'source' ? f.plan.change.path : f.plan.test.path), 0o664);
      await expect(runLocalCycle(f.options)).rejects.toThrow('UNSAFE_FILE');
      const store = createLocalJobStore({ directory: f.stateDirectory, organizationId: f.plan.organizationId,
        repository: f.plan.repository, approvedPlanDigest: planDigest(f.plan) });
      expect(await store.get('pilot:implement')).toBeNull();
      expect(await readFile(join(f.root, f.plan.change.path), 'utf8')).toBe(f.before);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });
  it.each([
    ['branch', "execFileSync('git', ['switch', '-c', 'main']);"],
    ['commit', "execFileSync('git', ['commit', '--allow-empty', '-m', 'unexpected concurrent commit']);"],
    ['unrelated file', "writeFileSync('unexpected.txt', 'unrelated side effect');"]
  ])('never certifies acceptance after the %s changes during the test', async (_kind, mutation) => {
    const f = await fixture();
    try {
      const test = "import {execFileSync} from 'node:child_process';\nimport {writeFileSync} from 'node:fs';\n" + mutation + '\n';
      await writeFile(join(f.root, f.plan.test.path), test);
      git(f.root, 'add', f.plan.test.path); git(f.root, 'commit', '-m', 'reviewed acceptance fixture');
      f.plan.baseSha = git(f.root, 'rev-parse', 'HEAD');
      f.plan.test.sha256 = hash(test);
      const options = { ...f.options, approvedDigest: planDigest(f.plan) };
      await runLocalCycle(options);
      expect((await runLocalCycle(options)).status).toBe('blocked');
      const store = createLocalJobStore({ directory: f.stateDirectory, organizationId: f.plan.organizationId,
        repository: f.plan.repository, approvedPlanDigest: planDigest(f.plan) });
      const receipt = await store.get('pilot:test');
      expect(receipt.job.status).toBe('blocked');
      expect(receipt.evidence).toBeUndefined();
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });
  it.each(['complete', 'partial'])('recovers an expired worker-owned %s source temporary before retrying', async kind => {
    const f = await fixture();
    try {
      const store = createLocalJobStore({ directory: f.stateDirectory, organizationId: f.plan.organizationId,
        repository: f.plan.repository, approvedPlanDigest: planDigest(f.plan) });
      const job = enqueue({ id: 'pilot:implement', sourceEventId: planDigest(f.plan), repository: f.plan.repository,
        targetSha: f.plan.baseSha, action: 'implement', maxAttempts: 2 }, 0);
      await store.insert(job);
      await store.compareAndSwap(job.id, 0, claim(job, 'previous-process', 0, 1000).job);
      const temporary = join(f.root, 'packages/pilot/.atlas-previous-process.tmp');
      await writeFile(temporary, kind === 'complete' ? f.after : f.after.slice(0, 10), { mode: 0o600 });
      expect((await runLocalCycle(f.options)).executed).toEqual(['pilot:implement']);
      await expect(stat(temporary)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(join(f.root, f.plan.change.path), 'utf8')).toBe(f.after);
      expect((await store.get(job.id)).job.attempts).toBe(2);
      expect((await runLocalCycle(f.options)).status).toBe('completed');
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });
  it('keeps an unknown temporary intact instead of deleting an unrelated file', async () => {
    const f = await fixture();
    try {
      const temporary = join(f.root, 'packages/pilot/.atlas-unrelated.tmp');
      await writeFile(temporary, f.after);
      await expect(runLocalCycle(f.options)).rejects.toThrow('REPOSITORY_DIRTY');
      expect(await readFile(temporary, 'utf8')).toBe(f.after);
      expect(await readFile(join(f.root, f.plan.change.path), 'utf8')).toBe(f.before);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });
  it.each(['active lease', 'conflicting content'])('keeps a known temporary intact with %s', async reason => {
    const f = await fixture();
    try {
      const store = createLocalJobStore({ directory: f.stateDirectory, organizationId: f.plan.organizationId,
        repository: f.plan.repository, approvedPlanDigest: planDigest(f.plan) });
      const job = enqueue({ id: 'pilot:implement', sourceEventId: planDigest(f.plan), repository: f.plan.repository,
        targetSha: f.plan.baseSha, action: 'implement', maxAttempts: 2 }, 0);
      await store.insert(job);
      await store.compareAndSwap(job.id, 0, claim(job, 'previous-process', reason === 'active lease' ? Date.now() : 0, 300000).job);
      const temporary = join(f.root, 'packages/pilot/.atlas-previous-process.tmp');
      const content = reason === 'active lease' ? f.after : 'unrelated bytes';
      await writeFile(temporary, content, { mode: 0o600 });
      expect((await runLocalCycle(f.options)).status).toBe(reason === 'active lease' ? 'paused' : 'blocked');
      expect(await readFile(temporary, 'utf8')).toBe(content);
      expect(await readFile(join(f.root, f.plan.change.path), 'utf8')).toBe(f.before);
      expect((await store.get(job.id)).evidence).toBeUndefined();
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });
  it('never trusts a completed checkpoint without acceptance evidence', async () => {
    const f = await fixture();
    try {
      await runLocalCycle(f.options);
      const file = join(f.stateDirectory, 'jobs.v1.json');
      const state = JSON.parse(await readFile(file, 'utf8'));
      state.jobs.find((s: any) => s.job.id === 'pilot:test').job.status = 'completed';
      await writeFile(file, JSON.stringify(state));
      await expect(runLocalCycle(f.options)).rejects.toThrow('STATE_EVIDENCE_REQUIRED');
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('snapshots the approved plan before asynchronous work can mutate the input', async () => {
    const f = await fixture();
    try {
      const running = runLocalCycle(f.options);
      f.plan.change.content = 'unapproved concurrent replacement';
      await running;
      expect(await readFile(join(f.root, f.plan.change.path), 'utf8')).toBe(f.after);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('recovers an expired interrupted implementation by verifying the already applied digest', async () => {
    const f = await fixture();
    try {
      const s = createLocalJobStore({ directory: f.stateDirectory, organizationId: f.plan.organizationId,
        repository: f.plan.repository, approvedPlanDigest: planDigest(f.plan) });
      const job = enqueue({ id: 'pilot:implement', sourceEventId: planDigest(f.plan), repository: f.plan.repository,
        targetSha: f.plan.baseSha, action: 'implement', maxAttempts: 2 }, 0);
      await s.insert(job);
      await s.compareAndSwap(job.id, 0, claim(job, 'previous-process', 0, 1000).job);
      await writeFile(join(f.root, f.plan.change.path), f.after);
      const resumed = await runLocalCycle(f.options);
      expect(resumed.executed).toEqual(['pilot:implement']);
      expect((await s.get('pilot:implement')).job.attempts).toBe(2);
      expect((await runLocalCycle(f.options)).status).toBe('completed');
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });
  it('implements in process A; process B resumes and runs real tests; process C is idempotent', async () => {
    const f = await fixture();
    try {
      const planPath = join(f.dir, 'plan.json'); await writeFile(planPath, JSON.stringify(f.plan));
      const cli = resolve('scripts/atlas-777-local-cycle.mjs');
      const execute = () => JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types',
        cli, f.root, f.stateDirectory, planPath, planDigest(f.plan)],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
      const first = execute();
      expect(first.status).toBe('paused'); expect(first.executed).toEqual(['pilot:implement']);
      expect(await readFile(join(f.root, f.plan.change.path), 'utf8')).toBe(f.after);
      const second = execute();
      expect(second.status).toBe('completed'); expect(second.executed).toEqual(['pilot:test']);
      const third = execute();
      expect(third.status).toBe('completed'); expect(third.executed).toEqual([]);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  }, 20000);

  it('requires the approved exact plan digest before writing source or state', async () => {
    const f = await fixture();
    try {
      await expect(runLocalCycle({ ...f.options, approvedDigest: '0'.repeat(64) })).rejects.toThrow('PLAN_NOT_APPROVED');
      expect(await readFile(join(f.root, f.plan.change.path), 'utf8')).toBe(f.before);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('rejects checkpoint directories inside the worktree, including dot-prefixed lookalikes', async () => {
    const f = await fixture();
    try {
      await expect(runLocalCycle({ ...f.options, stateDirectory: join(f.root, '..state') })).rejects.toThrow('CYCLE_CONFIGURATION');
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('rejects protected branches, traversal and symlinked source paths', async () => {
    const f = await fixture();
    try {
      for (const path of ['../outside.mjs', '.github/workflows/a.yml', 'packages/../outside.mjs', 'packages/x/node_modules/a.mjs']) {
        const plan = { ...f.plan, change: { ...f.plan.change, path } };
        await expect(runLocalCycle({ ...f.options, plan, approvedDigest: planDigest(plan) })).rejects.toThrow('PLAN_INVALID');
      }
      git(f.root, 'switch', '-c', 'main');
      await expect(runLocalCycle(f.options)).rejects.toThrow('REPOSITORY_MISMATCH');
      git(f.root, 'switch', 'feat/resume-pilot');
      await rm(join(f.root, f.plan.change.path));
      const outside = join(f.dir, 'outside.mjs'); await writeFile(outside, f.before);
      await symlink(outside, join(f.root, f.plan.change.path));
      await expect(runLocalCycle(f.options)).rejects.toThrow('UNSAFE_FILE');
      expect(await readFile(outside, 'utf8')).toBe(f.before);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('blocks changed tests and unexpected source content without overwriting', async () => {
    const f = await fixture();
    try {
      await writeFile(join(f.root, f.plan.test.path), 'throw new Error("modified");');
      await expect(runLocalCycle(f.options)).rejects.toThrow('REPOSITORY_DIRTY');
      git(f.root, 'restore', f.plan.test.path);
      await writeFile(join(f.root, f.plan.change.path), 'concurrent user edit');
      await expect(runLocalCycle(f.options)).rejects.toThrow('SOURCE_CONFLICT');
      expect(await readFile(join(f.root, f.plan.change.path), 'utf8')).toBe('concurrent user edit');
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('serializes persistence CAS and isolates organization namespaces', async () => {
    const f = await fixture();
    try {
      const s = createLocalJobStore({ directory: f.stateDirectory, organizationId: f.plan.organizationId, repository: f.plan.repository });
      await runLocalCycle(f.options);
      const snapshot = await s.get('pilot:implement');
      const results = await Promise.all([s.compareAndSwap('pilot:implement', snapshot.version, snapshot.job), s.compareAndSwap('pilot:implement', snapshot.version, snapshot.job)]);
      expect(results.filter(Boolean)).toHaveLength(1);
      const other = createLocalJobStore({ directory: f.stateDirectory, organizationId: 'other-org', repository: f.plan.repository });
      await expect(other.get('pilot:implement')).rejects.toThrow('STATE_SCOPE_MISMATCH');
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('failed acceptance never completes the job and does not expose test output', async () => {
    const f = await fixture();
    try {
      const plan = { ...f.plan, change: { ...f.plan.change, content: 'export const answer = () => 1;\n' } };
      const options = { ...f.options, plan, approvedDigest: planDigest(plan) };
      await runLocalCycle(options);
      const result = await runLocalCycle(options);
      expect(result.status).toBe('blocked'); expect(result.reason).toBe('ACCEPTANCE_FAILED');
      expect(JSON.stringify(result)).not.toContain('ERR_ASSERTION');
      const s = createLocalJobStore({ directory: f.stateDirectory, organizationId: plan.organizationId, repository: plan.repository });
      expect((await s.get('pilot:test')).job.status).toBe('blocked');
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('rejects an approved plan targeting a different commit', async () => {
    const f = await fixture();
    try {
      const plan = { ...f.plan, baseSha: 'a'.repeat(40) };
      await expect(runLocalCycle({ ...f.options, plan, approvedDigest: planDigest(plan) })).rejects.toThrow('REPOSITORY_MISMATCH');
      expect(await readFile(join(f.root, f.plan.change.path), 'utf8')).toBe(f.before);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('concurrent cycles do not repeat the implementation', async () => {
    const f = await fixture();
    try {
      const results = await Promise.all([runLocalCycle(f.options), runLocalCycle(f.options)]);
      expect(results.flatMap(r => r.executed).filter(id => id === 'pilot:implement')).toHaveLength(1);
      expect(await readFile(join(f.root, f.plan.change.path), 'utf8')).toBe(f.after);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });

  it('an interrupted second attempt is dead-lettered instead of repeated indefinitely', async () => {
    const f = await fixture();
    try {
      const s = createLocalJobStore({ directory: f.stateDirectory, organizationId: f.plan.organizationId,
        repository: f.plan.repository, approvedPlanDigest: planDigest(f.plan) });
      const job = enqueue({ id: 'pilot:implement', sourceEventId: planDigest(f.plan), repository: f.plan.repository,
        targetSha: f.plan.baseSha, action: 'implement', maxAttempts: 2 }, 0);
      await s.insert(job);
      await s.compareAndSwap(job.id, 0, { ...claim(job, 'interrupted', 0, 1000).job, attempts: 2 });
      const result = await runLocalCycle(f.options);
      expect(result.status).toBe('blocked'); expect(result.reason).toBe('retry_exhausted');
      expect((await s.get(job.id)).job.status).toBe('dead_letter');
      expect(await readFile(join(f.root, f.plan.change.path), 'utf8')).toBe(f.before);
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  });
});

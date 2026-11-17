/** Trusted local adapter: approved bounded edits + real acceptance, no model/network. */
import { promises as fs, constants } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { enqueue, claim, finish } from '../../apps/web/src/lib/atlas777Executor.ts';
import { createLocalJobStore } from './local-job-store.mjs';

const run = promisify(execFile);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw new Error(code); };
const safeId = s => typeof s === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,80}$/.test(s);
const hashPattern = /^[a-f0-9]{64}$/;
export const planDigest = plan => sha256(JSON.stringify(plan));

function validPath(path, test = false) {
  return typeof path === 'string' && /^[a-zA-Z0-9_./-]+$/.test(path) && !isAbsolute(path)
    && !path.split('/').some(p => !p || p.startsWith('.') || ['node_modules', 'dist', 'build'].includes(p))
    && (test ? /^tests\/.+\.test\.mjs$/.test(path) : /^(?:packages\/|apps\/web\/src\/|tests\/fixtures\/).+\.(?:mjs|js|ts|tsx|css)$/.test(path));
}
function validate(plan) {
  if (!plan || plan.version !== 1 || !safeId(plan.id) || !safeId(plan.sourceEventId) || !safeId(plan.organizationId)
      || !/^[\w.-]+\/[\w.-]+$/.test(plan.repository) || !/^[a-f0-9]{40}$/.test(plan.baseSha)
      || !/^(?:feat|fix|audit)\/[a-zA-Z0-9._/-]+$/.test(plan.branch) || plan.branch.includes('..')
      || !validPath(plan.change?.path) || !hashPattern.test(plan.change?.beforeSha256)
      || typeof plan.change?.content !== 'string' || Buffer.byteLength(plan.change.content) > 65536
      || !validPath(plan.test?.path, true) || !hashPattern.test(plan.test?.sha256)
      || plan.change.path === plan.test.path) fail('PLAN_INVALID');
}
async function safeFile(root, path) {
  const file = join(root, path); let current = root;
  for (const segment of path.split('/')) {
    current = join(current, segment);
    const s = await fs.lstat(current);
    if (s.isSymbolicLink() || (!s.isFile() && !s.isDirectory())) fail('UNSAFE_FILE');
  }
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.getuid()
        || (stat.mode & 0o022) || stat.size > 1048576) fail('UNSAFE_FILE');
    const bytes = await handle.readFile();
    return { file, bytes, content: bytes.toString('utf8'), mode: stat.mode & 0o777, uid: stat.uid };
  } finally { await handle.close(); }
}
const cleanEnv = () => ({ PATH: process.env.PATH || '/usr/bin:/bin', LANG: 'C', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' });
async function git(root, ...args) {
  const result = await run('git', args, { cwd: root, env: cleanEnv(), timeout: 10000, maxBuffer: 1048576 });
  return result.stdout;
}

function temporaryPath(sourcePath, owner) {
  if (typeof owner !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(owner)) fail('STATE_INVALID');
  return join(dirname(sourcePath), `.atlas-${owner}.tmp`);
}
async function verifyRepository(root, plan, allowedTemporary = async () => []) {
  if ((await git(root, 'branch', '--show-current')).trim() !== plan.branch
      || (await git(root, 'rev-parse', 'HEAD')).trim() !== plan.baseSha) fail('REPOSITORY_MISMATCH');
  if ((await git(root, 'diff', '--cached', '--name-only')).trim()) fail('REPOSITORY_DIRTY');
  const dirty = [...(await git(root, 'diff', '--name-only', '-z')).split('\0'), ...(await git(root, 'ls-files', '--others', '--exclude-standard', '-z')).split('\0')].filter(Boolean);
  const permitted = await allowedTemporary();
  if (dirty.some(path => path !== plan.change.path && !permitted.includes(path))) fail('REPOSITORY_DIRTY');
}

export async function runLocalCycle({ repositoryRoot, stateDirectory, plan, approvedDigest, maxJobs = 1 }) {
  // Approval binds an immutable snapshot, not an object a caller can mutate while we await I/O.
  plan = structuredClone(plan);
  validate(plan);
  if (!hashPattern.test(approvedDigest) || approvedDigest !== planDigest(plan)) fail('PLAN_NOT_APPROVED');
  if (!isAbsolute(repositoryRoot) || !isAbsolute(stateDirectory) || !Number.isSafeInteger(maxJobs) || maxJobs < 1 || maxJobs > 2) fail('CYCLE_CONFIGURATION');
  const root = resolve(repositoryRoot);
  const stateRelative = relative(root, resolve(stateDirectory));
  if (await fs.realpath(root) !== root || !(stateRelative === '..' || stateRelative.startsWith('../'))) fail('CYCLE_CONFIGURATION');
  const digest = planDigest(plan);
  const store = createLocalJobStore({ directory: stateDirectory, organizationId: plan.organizationId,
    repository: plan.repository, approvedPlanDigest: digest });
  await verifyRepository(root, plan, async () => {
    // Read after the dirt scan: another worker must persist its lease before creating a temp.
    const pending = await store.get(`${plan.id}:implement`);
    return pending?.job.status === 'leased' && pending.job.sourceEventId === digest
      && pending.job.targetSha === plan.baseSha && pending.job.action === 'implement'
      ? [temporaryPath(plan.change.path, pending.job.leaseOwner)] : [];
  });
  const source = await safeFile(root, plan.change.path);
  const testFile = await safeFile(root, plan.test.path);
  if (sha256(testFile.content) !== plan.test.sha256) fail('TEST_CONFLICT');
  const afterDigest = sha256(plan.change.content);
  if (![plan.change.beforeSha256, afterDigest].includes(sha256(source.content))) fail('SOURCE_CONFLICT');

  const owner = `worker-${randomUUID()}`;
  const executed = [];
  for (const action of ['implement', 'test']) {
    const id = `${plan.id}:${action}`;
    let snapshot = await store.get(id);
    if (!snapshot) {
      await store.insert(enqueue({ id, sourceEventId: digest, repository: plan.repository,
        targetSha: plan.baseSha, action, maxAttempts: 2 }, Date.now()));
      snapshot = await store.get(id);
      if (!snapshot) return { status: 'paused', executed, reason: 'STORE_BUSY' };
    }
    if (snapshot.job.sourceEventId !== digest || snapshot.job.targetSha !== plan.baseSha || snapshot.job.action !== action) fail('STATE_PLAN_MISMATCH');
    if (snapshot.job.status === 'completed') {
      if (snapshot.evidence?.planDigest !== digest || snapshot.evidence?.digest !== (action === 'implement' ? afterDigest : plan.test.sha256)) fail('STATE_EVIDENCE_REQUIRED');
      if (sha256((await safeFile(root, plan.change.path)).content) !== afterDigest) fail('COMPLETED_SOURCE_CHANGED');
      continue;
    }
    if (executed.length >= maxJobs) return { status: 'paused', executed, next: id };
    const transition = claim(snapshot.job, owner, Date.now(), 300000);
    if (!transition.accepted) {
      if (transition.job.status === 'dead_letter') await store.compareAndSwap(id, snapshot.version, transition.job);
      const waiting = transition.reason === 'backoff' || (transition.reason === 'not_claimable' && snapshot.job.status === 'leased');
      return { status: waiting ? 'paused' : 'blocked', executed, reason: transition.reason };
    }
    if (!await store.compareAndSwap(id, snapshot.version, transition.job)) return { status: 'paused', executed, reason: 'CONCURRENT_CLAIM' };
    let proof;
    try {
      const orphanPath = action === 'implement' && snapshot.job.status === 'leased'
        ? temporaryPath(plan.change.path, snapshot.job.leaseOwner) : null;
      await verifyRepository(root, plan, async () => orphanPath ? [orphanPath] : []);
      if (action === 'implement') {
        if (orphanPath) {
          let orphan;
          try { orphan = await safeFile(root, orphanPath); }
          catch (error) { if (error.code !== 'ENOENT') throw error; }
          if (orphan) {
            const approved = Buffer.from(plan.change.content);
            if (orphan.uid !== process.getuid() || (orphan.mode & 0o022)
                || !approved.subarray(0, orphan.bytes.length).equals(orphan.bytes)) fail('UNSAFE_TEMPORARY');
            // Only this expired lease's file, with approved complete/partial bytes, is recoverable.
            await fs.unlink(orphan.file);
          }
        }
        const latest = await safeFile(root, plan.change.path);
        const latestDigest = sha256(latest.content);
        if (latestDigest !== afterDigest) {
          if (latestDigest !== plan.change.beforeSha256) fail('SOURCE_CONFLICT');
          const temp = join(root, temporaryPath(plan.change.path, owner));
          const handle = await fs.open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
          try {
            await handle.writeFile(plan.change.content); await handle.chmod(latest.mode); await handle.sync(); await handle.close();
            await fs.rename(temp, latest.file);
            const parent = await fs.open(dirname(latest.file), constants.O_RDONLY);
            try { await parent.sync(); } finally { await parent.close(); }
          } finally { await handle.close().catch(() => {}); await fs.rm(temp, { force: true }); }
        }
        if (sha256((await safeFile(root, plan.change.path)).content) !== afterDigest) fail('SOURCE_CONFLICT');
        proof = { kind: 'source-sha256', digest: afterDigest };
      } else {
        if (sha256((await safeFile(root, plan.change.path)).content) !== afterDigest) fail('SOURCE_CONFLICT');
        // Only a reviewed, digest-bound repository test. No shell or arbitrary args.
        await run(process.execPath, ['--test', plan.test.path], { cwd: root, env: cleanEnv(), timeout: 30000, maxBuffer: 65536 });
        if (sha256((await safeFile(root, plan.test.path)).content) !== plan.test.sha256
            || sha256((await safeFile(root, plan.change.path)).content) !== afterDigest) fail('SOURCE_CONFLICT');
        proof = { kind: 'node-test', digest: plan.test.sha256, exitCode: 0 };
      }
      // A passing process cannot certify a branch, commit or dirty worktree changed by that process.
      await verifyRepository(root, plan);
    } catch {
      const denied = finish(transition.job, owner, Date.now(), 'blocked');
      if (denied.accepted) await store.compareAndSwap(id, snapshot.version + 1, denied.job);
      return { status: 'blocked', executed, reason: action === 'test' ? 'ACCEPTANCE_FAILED' : 'IMPLEMENTATION_FAILED' };
    }
    const completed = finish(transition.job, owner, Date.now(), 'completed');
    if (!completed.accepted || !await store.compareAndSwap(id, snapshot.version + 1, completed.job,
      { ...proof, verified: true, baseSha: plan.baseSha, planDigest: digest, workerId: owner,
        localUid: process.getuid(), sourceEventId: plan.sourceEventId, observedAt: new Date().toISOString() })) {
      return { status: 'blocked', executed, reason: 'COMPLETION_CONFLICT' };
    }
    executed.push(id);
  }
  await verifyRepository(root, plan);
  return { status: 'completed', executed, planDigest: digest, baseSha: plan.baseSha, productionVerified: false };
}

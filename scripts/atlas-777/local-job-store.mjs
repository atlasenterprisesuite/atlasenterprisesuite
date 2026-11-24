/** POSIX local adapter for PR #867 AtomicJobStore. Same-OS-user trust boundary. */
import { promises as fs, constants } from 'node:fs';
import { isAbsolute, resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const shaPattern = /^[a-f0-9]{40}$/;
const fail = code => { throw new Error(code); };
const immutable = ['id', 'sourceEventId', 'repository', 'targetSha', 'action', 'maxAttempts'];

export function createLocalJobStore({ directory, organizationId, repository, approvedPlanDigest = null }) {
  if (process.platform === 'win32') fail('POSIX_STORE_REQUIRED');
  if (!isAbsolute(directory) || !idPattern.test(organizationId) || !/^[\w.-]+\/[\w.-]+$/.test(repository)
      || (approvedPlanDigest !== null && !/^[a-f0-9]{64}$/.test(approvedPlanDigest))) fail('STATE_CONFIGURATION');
  const dir = resolve(directory);
  const file = join(dir, 'jobs.v1.json');
  async function prepare() {
    await fs.mkdir(dir, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
    const stat = await fs.lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077) || await fs.realpath(dir) !== dir) fail('UNSAFE_STATE_DIRECTORY');
  }
  async function read() {
    await prepare();
    let handle;
    try {
      handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.getuid() || (stat.mode & 0o077) || stat.size > 1048576) fail('UNSAFE_STATE_FILE');
      const state = JSON.parse(await handle.readFile('utf8'));
      if (state.organizationId !== organizationId || state.repository !== repository) fail('STATE_SCOPE_MISMATCH');
      if (approvedPlanDigest !== null && state.approvedPlanDigest !== approvedPlanDigest) fail('STATE_PLAN_MISMATCH');
      if (state.schema !== 1 || !Array.isArray(state.jobs) || state.jobs.length > 1000) fail('STATE_INVALID');
      const ids = new Set();
      for (const s of state.jobs) {
        if (!s?.job || !idPattern.test(s.job.id) || ids.has(s.job.id) || !Number.isSafeInteger(s.version) || s.version < 0 || s.job.repository !== repository || !shaPattern.test(s.job.targetSha)) fail('STATE_INVALID');
        if (s.job.status === 'completed') validateProof(s.job, s.evidence);
        ids.add(s.job.id);
      }
      return state;
    } catch (e) {
      if (e.code === 'ENOENT') return { schema: 1, organizationId, repository, approvedPlanDigest, jobs: [] };
      throw e;
    } finally { await handle?.close(); }
  }
  function validateProof(job, proof) {
    if (!proof || proof.verified !== true || proof.baseSha !== job.targetSha
        || proof.planDigest !== job.sourceEventId || !/^[a-f0-9]{64}$/.test(proof.digest)
        || !Number.isFinite(Date.parse(proof.observedAt))
        || (job.action === 'implement' && proof.kind !== 'source-sha256')
        || (job.action === 'test' && (proof.kind !== 'node-test' || proof.exitCode !== 0))) fail('STATE_EVIDENCE_REQUIRED');
  }
  async function mutate(fn) {
    await prepare();
    const lockPath = join(dir, '.jobs.lock');
    let lock;
    try { lock = await fs.open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600); }
    catch (e) { if (e.code === 'EEXIST') return false; throw e; }
    const temp = join(dir, `.jobs-${randomUUID()}.tmp`);
    try {
      const state = await read();
      if (!fn(state)) return false;
      const data = JSON.stringify(state);
      if (Buffer.byteLength(data) > 1048576) fail('STATE_LIMIT');
      const output = await fs.open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      try { await output.writeFile(data); await output.sync(); } finally { await output.close(); }
      await fs.rename(temp, file);
      const parent = await fs.open(dir, constants.O_RDONLY);
      try { await parent.sync(); } finally { await parent.close(); }
      return true;
    } finally {
      await fs.rm(temp, { force: true });
      await lock.close(); await fs.unlink(lockPath);
    }
  }
  return {
    async get(id) {
      if (!idPattern.test(id)) fail('STATE_INVALID_ID');
      return structuredClone((await read()).jobs.find(s => s.job.id === id) || null);
    },
    async insert(job) {
      if (!job || !idPattern.test(job.id) || job.repository !== repository || !shaPattern.test(job.targetSha) || job.status !== 'queued') fail('STATE_INVALID_JOB');
      return mutate(state => {
        if (state.jobs.some(s => s.job.id === job.id)) return false;
        state.jobs.push({ job: structuredClone(job), version: 0 }); return true;
      });
    },
    async compareAndSwap(id, version, next, evidence) {
      return mutate(state => {
        const i = state.jobs.findIndex(s => s.job.id === id);
        if (i < 0 || state.jobs[i].version !== version) return false;
        const previous = state.jobs[i];
        if (immutable.some(k => next[k] !== previous.job[k])) fail('STATE_IDENTITY_MISMATCH');
        const proof = evidence || previous.evidence;
        if (next.status === 'completed') validateProof(next, proof);
        state.jobs[i] = { job: structuredClone(next), version: version + 1, ...(proof ? { evidence: proof } : {}) };
        return true;
      });
    }
  };
}

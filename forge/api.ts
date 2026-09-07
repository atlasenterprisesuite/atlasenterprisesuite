import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { access, appendFile, mkdir, open, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { FilesystemArtifactStore } from './artifacts.ts';
import { assertRunTransition, parsePipeline, type ForgeArtifactRecord, type ForgeJobRecord, type ForgeRunRecord, type ForgeRunStatus, type ForgeStepResult } from './core.ts';

export type ForgeApiConfig = {
  home: string; repositoriesRoot: string; pipelinesRoot: string; controlToken: string; runnerToken: string; bindHost: string; port: number; testMode?: boolean;
};
export function loadForgeApiConfig(env: NodeJS.ProcessEnv = process.env): ForgeApiConfig {
  const home = env.ATLAS_FORGE_HOME ?? '.atlas-forge', controlToken = env.ATLAS_FORGE_CONTROL_TOKEN ?? '', runnerToken = env.ATLAS_FORGE_RUNNER_TOKEN ?? '';
  if (controlToken.length < 32 || runnerToken.length < 32) throw new Error('Forge control and runner tokens must be at least 32 characters');
  const port = Number(env.ATLAS_FORGE_PORT ?? '8788'); if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('ATLAS_FORGE_PORT is invalid');
  return { home, repositoriesRoot: env.ATLAS_FORGE_REPOSITORIES_ROOT ?? `${home}/repos`, pipelinesRoot: env.ATLAS_FORGE_PIPELINES_ROOT ?? '.atlas/forge/pipelines', controlToken, runnerToken, bindHost: env.ATLAS_FORGE_BIND ?? '127.0.0.1', port };
}
function tokenMatches(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith('Bearer ')) return false; const a = Buffer.from(header.slice(7), 'utf8'), b = Buffer.from(expected, 'utf8'); if (a.length !== b.length) return false; return timingSafeEqual(a, b);
}
export type ForgeAuditEvent = { id: string; tenantId: string; organizationId: string; actorId: string; action: string; entityType: string; entityId: string; before: unknown; after: unknown; timestamp: string; correlationId: string };
export class FileAuditSink {
  private readonly path: string; constructor(path: string) { this.path = path; }
  async append(event: ForgeAuditEvent): Promise<void> { await mkdir(dirname(this.path), { recursive: true, mode: 0o700 }); await appendFile(this.path, `${JSON.stringify(event)}\n`, { mode: 0o600 }); }
}
async function atomicWrite(path: string, value: unknown): Promise<void> {
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`; await mkdir(dirname(path), { recursive: true, mode: 0o700 }); await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); const handle = await open(temp, 'r+'); await handle.sync(); await handle.close(); await rename(temp, path);
}
export class FileStateStore {
  private readonly runsDir: string; private readonly jobsDir: string;
  constructor(home: string) { this.runsDir = join(home, 'state', 'runs'); this.jobsDir = join(home, 'state', 'jobs'); }
  async initialize(): Promise<void> { await mkdir(this.runsDir, { recursive: true, mode: 0o700 }); await mkdir(this.jobsDir, { recursive: true, mode: 0o700 }); }
  async putRun(run: ForgeRunRecord): Promise<void> { await atomicWrite(join(this.runsDir, `${run.id}.json`), run); }
  async putJob(job: ForgeJobRecord): Promise<void> { await atomicWrite(join(this.jobsDir, `${job.id}.json`), job); }
  async getRun(id: string): Promise<ForgeRunRecord | null> { try { return JSON.parse(await readFile(join(this.runsDir, `${id}.json`), 'utf8')) as ForgeRunRecord; } catch (error) { if (error instanceof Error && /ENOENT/.test(error.message)) return null; throw error; } }
  async getJob(id: string): Promise<ForgeJobRecord | null> { try { return JSON.parse(await readFile(join(this.jobsDir, `${id}.json`), 'utf8')) as ForgeJobRecord; } catch (error) { if (error instanceof Error && /ENOENT/.test(error.message)) return null; throw error; } }
  async oldestQueuedJob(): Promise<ForgeJobRecord | null> { const files = (await readdir(this.jobsDir)).filter((name) => name.endsWith('.json')); const jobs = (await Promise.all(files.map((name) => readFile(join(this.jobsDir, name), 'utf8').then((raw) => JSON.parse(raw) as ForgeJobRecord)))).filter((job) => job.status === 'queued').sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)); return jobs[0] ?? null; }
  async writable(): Promise<boolean> { try { await access(this.runsDir, constants.R_OK | constants.W_OK); await access(this.jobsDir, constants.R_OK | constants.W_OK); return true; } catch { return false; } }
}
function send(res: ServerResponse, status: number, value: unknown): void { res.statusCode = status; res.setHeader('content-type', 'application/json'); if (status === 204) { res.end(); return; } res.end(JSON.stringify(value)); }
async function readBody(req: IncomingMessage): Promise<any> { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const buffer = Buffer.from(chunk); size += buffer.length; if (size > 1_000_000) throw new Error('request body too large'); chunks.push(buffer); } return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
function actorEvent(action: string, entityType: string, entityId: string, actorId: string, correlationId: string, before: unknown, after: unknown): ForgeAuditEvent { return { id: randomUUID(), tenantId: 'forge-system', organizationId: 'forge-system', actorId, action, entityType, entityId, before, after, timestamp: new Date().toISOString(), correlationId }; }
const REPO_RE = /^[a-z0-9][a-z0-9-]{0,63}$/, SHA_RE = /^[0-9a-f]{40}$/, DIGEST_RE = /^[0-9a-f]{64}$/;
function verifyPassedStepEvidence(job: ForgeJobRecord, stepResults: readonly ForgeStepResult[]): void {
  if (stepResults.length !== job.pipeline.steps.length) throw new Error('passed run requires complete step evidence');
  for (let index = 0; index < job.pipeline.steps.length; index += 1) {
    const expected = job.pipeline.steps[index], actual = stepResults[index];
    if (!actual || actual.stepId !== expected.id || actual.status !== 'passed') throw new Error('passed run contains invalid step evidence');
  }
}
async function verifyArtifactEvidence(artifact: ForgeArtifactRecord, run: ForgeRunRecord, home: string): Promise<void> {
  if (!DIGEST_RE.test(artifact.digest) || artifact.id !== artifact.digest) throw new Error('invalid artifact digest');
  if (artifact.sourceSha !== run.sourceSha || artifact.runId !== run.id || artifact.verified !== true) throw new Error('artifact is not bound to this run');
  const artifactRoot = resolve(home, 'artifacts', artifact.digest);
  if (resolve(artifact.manifestPath) !== resolve(artifactRoot, 'manifest.json') || resolve(artifact.payloadPath) !== resolve(artifactRoot, 'payload')) throw new Error('artifact path is outside the Forge vault');
  if (!(await new FilesystemArtifactStore(home).verifyArtifact(artifact))) throw new Error('artifact integrity verification failed');
}
export function createForgeServer(config: ForgeApiConfig) {
  if (!config.testMode && (config.controlToken.length < 32 || config.runnerToken.length < 32)) throw new Error('Forge tokens must be at least 32 characters');
  const state = new FileStateStore(config.home), audit = new FileAuditSink(join(config.home, 'audit', 'events.jsonl')), logsRoot = join(config.home, 'logs'), artifactsRoot = join(config.home, 'artifacts');
  const init = Promise.all([state.initialize(), mkdir(config.repositoriesRoot, { recursive: true, mode: 0o700 }), mkdir(config.pipelinesRoot, { recursive: true, mode: 0o700 }), mkdir(logsRoot, { recursive: true, mode: 0o700 }), mkdir(artifactsRoot, { recursive: true, mode: 0o700 })]);
  let claimLock: Promise<void> = Promise.resolve();
  const serializeClaim = async <T>(operation: () => Promise<T>): Promise<T> => {
    const previous = claimLock; let release!: () => void; claimLock = new Promise<void>((resolve) => { release = resolve; });
    await previous; try { return await operation(); } finally { release(); }
  };
  return createServer(async (req, res) => {
    try {
      await init; const url = new URL(req.url ?? '/', 'http://forge.local');
      if (req.method === 'GET' && url.pathname === '/healthz') { const checks: Record<string, boolean> = { state: await state.writable() }; for (const [name, path] of [['repositories', config.repositoriesRoot], ['logs', logsRoot], ['artifacts', artifactsRoot]] as const) { try { await access(path, constants.R_OK | constants.W_OK); checks[name] = true; } catch { checks[name] = false; } } const ready = Object.values(checks).every(Boolean); return send(res, ready ? 200 : 503, { status: ready ? 'ready' : 'degraded', checks }); }
      const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined, isControl = tokenMatches(authHeader, config.controlToken), isRunner = tokenMatches(authHeader, config.runnerToken);
      if (req.method === 'POST' && url.pathname === '/v1/runs') {
        if (!isControl) return send(res, 401, { error: 'unauthorized' }); const input = await readBody(req);
        if (!REPO_RE.test(input.repositoryId ?? '')) return send(res, 400, { error: 'invalid repositoryId' }); if (!SHA_RE.test(input.sourceSha ?? '')) return send(res, 400, { error: 'invalid sourceSha' }); const pipelineId = typeof input.pipelineId === 'string' ? input.pipelineId : ''; if (!REPO_RE.test(pipelineId)) return send(res, 400, { error: 'invalid pipelineId' });
        const pipeline = parsePipeline(JSON.parse(await readFile(join(config.pipelinesRoot, `${pipelineId}.json`), 'utf8'))), runId = randomUUID(), jobId = randomUUID(), correlationId = randomUUID(), createdAt = new Date().toISOString();
        const run: ForgeRunRecord = { id: runId, repositoryId: input.repositoryId, sourceSha: input.sourceSha, pipelineId: pipeline.id, pipelineVersion: pipeline.version, trigger: ['manual', 'push', 'review', 'retry'].includes(input.trigger) ? input.trigger : 'manual', requestedBy: typeof input.requestedBy === 'string' && input.requestedBy ? input.requestedBy : 'unknown', correlationId, createdAt, startedAt: null, finishedAt: null, status: 'queued', artifact: null };
        const job: ForgeJobRecord = { id: jobId, runId, repositoryId: run.repositoryId, sourceSha: run.sourceSha, pipeline, createdAt, status: 'queued', assignedRunnerId: null, stepResults: [] };
        await state.putRun(run); await state.putJob(job); await audit.append(actorEvent('forge.run.create', 'forge_run', runId, run.requestedBy, correlationId, null, run)); return send(res, 201, { run, job });
      }
      if (req.method === 'POST' && url.pathname === '/v1/jobs/claim') {
        if (!isRunner) return send(res, 401, { error: 'unauthorized' });
        const input = await readBody(req), runnerId = typeof input.runnerId === 'string' ? input.runnerId.trim() : '';
        if (!runnerId) return send(res, 400, { error: 'runnerId required' });
        return await serializeClaim(async () => {
          const queued = await state.oldestQueuedJob(); if (!queued) return send(res, 204, null);
          const run = await state.getRun(queued.runId); if (!run) return send(res, 409, { error: 'run missing' });
          assertRunTransition(queued.status, 'assigned'); assertRunTransition(run.status, 'assigned');
          const job: ForgeJobRecord = { ...queued, status: 'assigned', assignedRunnerId: runnerId }, nextRun: ForgeRunRecord = { ...run, status: 'assigned' };
          await state.putJob(job); await state.putRun(nextRun); await audit.append(actorEvent('forge.job.claim', 'forge_job', job.id, runnerId, run.correlationId, queued, job));
          return send(res, 200, { job });
        });
      }
      const startMatch = url.pathname.match(/^\/v1\/jobs\/([0-9a-f-]{36})\/start$/);
      if (req.method === 'POST' && startMatch) { if (!isRunner) return send(res, 401, { error: 'unauthorized' }); const input = await readBody(req), job = await state.getJob(startMatch[1]); if (!job) return send(res, 404, { error: 'job not found' }); if (job.assignedRunnerId !== input.runnerId) return send(res, 403, { error: 'runner mismatch' }); if (job.status !== 'assigned') return send(res, 409, { error: 'job not assigned' }); const run = await state.getRun(job.runId); if (!run) return send(res, 409, { error: 'run missing' }); assertRunTransition(job.status, 'running'); assertRunTransition(run.status, 'running'); const nextJob: ForgeJobRecord = { ...job, status: 'running' }, nextRun: ForgeRunRecord = { ...run, status: 'running', startedAt: new Date().toISOString() }; await state.putJob(nextJob); await state.putRun(nextRun); await audit.append(actorEvent('forge.job.start', 'forge_job', job.id, input.runnerId, run.correlationId, job, nextJob)); return send(res, 200, { job: nextJob }); }
      const logMatch = url.pathname.match(/^\/v1\/jobs\/([0-9a-f-]{36})\/log$/);
      if (req.method === 'POST' && logMatch) { if (!isRunner) return send(res, 401, { error: 'unauthorized' }); const input = await readBody(req), job = await state.getJob(logMatch[1]); if (!job) return send(res, 404, { error: 'job not found' }); if (job.assignedRunnerId !== input.runnerId) return send(res, 403, { error: 'runner mismatch' }); const line = String(input.line ?? '').replaceAll('\0', '').slice(0, 16 * 1024); await appendFile(join(logsRoot, `${job.id}.log`), `${line}\n`, { mode: 0o600 }); return send(res, 202, { accepted: true }); }
      const completeMatch = url.pathname.match(/^\/v1\/jobs\/([0-9a-f-]{36})\/complete$/);
      if (req.method === 'POST' && completeMatch) { if (!isRunner) return send(res, 401, { error: 'unauthorized' }); const input = await readBody(req), job = await state.getJob(completeMatch[1]); if (!job) return send(res, 404, { error: 'job not found' }); if (job.assignedRunnerId !== input.runnerId) return send(res, 403, { error: 'runner mismatch' }); if (job.status !== 'running') return send(res, 409, { error: 'job not running' }); const terminal = new Set<ForgeRunStatus>(['passed', 'failed', 'cancelled', 'timed_out', 'infrastructure_error']); if (!terminal.has(input.status)) return send(res, 400, { error: 'invalid status' }); const run = await state.getRun(job.runId); if (!run) return send(res, 409, { error: 'run missing' }); assertRunTransition(job.status, input.status); assertRunTransition(run.status, input.status); const stepResults = Array.isArray(input.stepResults) ? input.stepResults as ForgeStepResult[] : [], artifact = (input.artifact ?? null) as ForgeArtifactRecord | null; if (input.status === 'passed') { try { verifyPassedStepEvidence(job, stepResults); } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'invalid step evidence' }); } } if (artifact) { try { await verifyArtifactEvidence(artifact, run, config.home); } catch (error) { return send(res, 400, { error: error instanceof Error ? error.message : 'invalid artifact' }); } } const nextJob: ForgeJobRecord = { ...job, status: input.status, stepResults }, nextRun: ForgeRunRecord = { ...run, status: input.status, finishedAt: new Date().toISOString(), artifact }; await state.putJob(nextJob); await state.putRun(nextRun); await audit.append(actorEvent('forge.run.complete', 'forge_run', run.id, input.runnerId, run.correlationId, run, nextRun)); return send(res, 200, { run: nextRun, job: nextJob }); }
      const runMatch = url.pathname.match(/^\/v1\/runs\/([0-9a-f-]{36})$/);
      if (req.method === 'GET' && runMatch) { if (!isControl && !isRunner) return send(res, 401, { error: 'unauthorized' }); const run = await state.getRun(runMatch[1]); if (!run) return send(res, 404, { error: 'run not found' }); return send(res, 200, { run }); }
      return send(res, 404, { error: 'not found' });
    } catch (error) { const message = error instanceof Error ? error.message : String(error); return send(res, /transition|not running|not assigned/.test(message) ? 409 : 500, { error: message.slice(0, 1024) }); }
  });
}
if (import.meta.url === `file://${process.argv[1]}`) { const config = loadForgeApiConfig(); const server = createForgeServer(config); server.listen(config.port, config.bindHost, () => console.log(`ATLAS Forge API listening on http://${config.bindHost}:${config.port}`)); }

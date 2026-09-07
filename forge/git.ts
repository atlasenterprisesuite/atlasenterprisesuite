import { execFile } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import type { MirrorState } from './core.ts';
const execFileAsync = promisify(execFile);
const SHA_RE = /^[0-9a-f]{40}$/;
export async function initBareRepository(repositoryPath: string): Promise<void> {
  await mkdir(dirname(repositoryPath), { recursive: true });
  await execFileAsync('git', ['init', '--bare', repositoryPath]);
  await execFileAsync('git', ['--git-dir', repositoryPath, 'config', 'receive.denyNonFastForwards', 'true']);
}
export async function resolveCommit(repositoryPath: string, ref: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['--git-dir', repositoryPath, 'rev-parse', '--verify', `${ref}^{commit}`]);
  const sha = stdout.trim().toLowerCase(); if (!SHA_RE.test(sha)) throw new Error(`Git resolved invalid commit SHA for ${ref}`); return sha;
}
export async function checkoutExactSha(repositoryPath: string, sha: string, workspacePath: string): Promise<void> {
  if (!SHA_RE.test(sha)) throw new Error('Source SHA must be exactly 40 lowercase hex characters');
  await rm(workspacePath, { recursive: true, force: true }); await mkdir(dirname(workspacePath), { recursive: true });
  await execFileAsync('git', ['clone', '--no-checkout', repositoryPath, workspacePath]);
  await execFileAsync('git', ['-C', workspacePath, 'checkout', '--detach', sha]);
  const { stdout } = await execFileAsync('git', ['-C', workspacePath, 'rev-parse', 'HEAD']);
  const head = stdout.trim().toLowerCase(); if (head !== sha) throw new Error(`Exact-SHA verification failed: expected ${sha}, got ${head}`);
}
function classifyMirrorFailure(text: string): MirrorState {
  const lower = text.toLowerCase();
  if (/authentication|permission denied|could not read username|terminal prompts disabled|access denied|401|403/.test(lower)) return 'authentication_required';
  if (/rate.?limit|too many requests|secondary rate|429|throttl/.test(lower)) return 'rate_limited';
  return 'unavailable';
}
export async function syncMirror(repositoryPath: string, remoteName: string): Promise<{ state: MirrorState; message: string }> {
  try { const { stdout, stderr } = await execFileAsync('git', ['--git-dir', repositoryPath, 'fetch', remoteName, '--prune']); return { state: 'healthy', message: `${stdout}${stderr}`.trim() || 'Mirror synchronized' }; }
  catch (error) { const detail = error instanceof Error ? error.message : String(error); return { state: classifyMirrorFailure(detail), message: detail.slice(0, 4096) }; }
}

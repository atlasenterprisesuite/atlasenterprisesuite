import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPOSITORY = 'atlasenterprisesuite/atlasenterprisesuite';
const BRIDGE = 'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-repair-bridge';
const AUDIENCE = 'atlas-enterprise-suite-repair';
const MAX_CONTEXT_BYTES = 210_000;
const MAX_FILE_BYTES = 48_000;
const MAX_PATCH_BYTES = 100_000;
const APPLY_CHECK = 'git apply --check';

const PROTECTED_PATHS = [
  '.github/',
  'adapters/supabase/atlas-repair-bridge/',
  'scripts/atlas-ai-repair-runner.mjs',
  '.env',
  'credentials',
  'secrets',
];

const ALLOWED_PATCH_PREFIXES = [
  'modules/',
  'atlas/',
  'apps/',
  'adapters/',
  'scripts/',
  'docs/',
  'rideos-router.js',
  'package.json',
  'README.md',
];

const SAFE_TESTS = new Set([
  'npm run test:unit',
  'npm run test:integration',
  'npm run typecheck',
  'npm run build',
]);

function exec(command, args = [], options = {}) {
  const output = execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
  return typeof output === 'string' ? output.trim() : '';
}

async function responseJson(response) {
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || 'invalid_response' }; }
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `request_failed_${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function oidcToken() {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL || '';
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || '';
  if (!requestUrl || !requestToken) throw new Error('github_oidc_environment_missing');
  const separator = requestUrl.includes('?') ? '&' : '?';
  const response = await fetch(`${requestUrl}${separator}audience=${encodeURIComponent(AUDIENCE)}`, {
    headers: { Authorization: `Bearer ${requestToken}` },
  });
  const data = await responseJson(response);
  if (!data?.value) throw new Error('github_oidc_token_missing');
  return data.value;
}

async function bridge(api, token, body) {
  const response = await fetch(`${BRIDGE}?api=${encodeURIComponent(api)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return responseJson(response);
}

function requestTerms(job) {
  const text = `${job?.request_text || ''} ${JSON.stringify(job?.context || {})}`.toLowerCase();
  return [...new Set(text.match(/[a-z0-9][a-z0-9_-]{2,}/g) || [])].filter((term) => !['atlas', 'the', 'and', 'with', 'from', 'this', 'that'].includes(term));
}

function contextFileAllowed(path) {
  if (!path || path.includes('..')) return false;
  if (/^(node_modules|\.git)\//.test(path)) return false;
  if (/(^|\/)(\.env(?:\.|$)|credentials?|secrets?)(\/|$)/i.test(path)) return false;
  if (/package-lock\.json$|\.lock$/i.test(path)) return false;
  return /\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|css|scss|yml|yaml)$/i.test(path) || ['package.json', 'vercel.json', 'README.md'].includes(path);
}

function collectRepositoryContext(job) {
  const terms = requestTerms(job);
  const files = exec('git', ['ls-files']).split('\n').filter(Boolean).filter(contextFileAllowed);
  const priority = new Set(['package.json', 'vercel.json', 'README.md']);
  const ranked = files.map((path) => {
    const lower = path.toLowerCase();
    let score = priority.has(path) ? 1000 : 0;
    for (const term of terms) if (lower.includes(term)) score += 20;
    if (lower.startsWith('apps/web/src/')) score += 5;
    if (lower.startsWith('packages/')) score += 4;
    if (lower.startsWith('adapters/')) score += 3;
    return { path, score };
  }).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const chunks = [];
  let used = 0;
  for (const { path } of ranked) {
    let size = 0;
    try { size = statSync(path).size; } catch { continue; }
    if (size <= 0 || size > MAX_FILE_BYTES) continue;
    let content = '';
    try { content = readFileSync(path, 'utf8'); } catch { continue; }
    const chunk = `\n===== ${path} =====\n${content}\n`;
    if (used + Buffer.byteLength(chunk) > MAX_CONTEXT_BYTES) continue;
    chunks.push(chunk);
    used += Buffer.byteLength(chunk);
  }
  if (!chunks.length) throw new Error('repository_context_empty');
  return chunks.join('');
}

export function validatePatch(patch) {
  if (typeof patch !== 'string' || patch.length === 0 || Buffer.byteLength(patch) > MAX_PATCH_BYTES) {
    throw new Error('patch_size_invalid');
  }
  if (/GIT binary patch/i.test(patch) || /deleted file mode/i.test(patch)) {
    throw new Error('binary_or_delete_patch_forbidden');
  }
  const paths = [...patch.matchAll(/^\+\+\+\s+(?:b\/)?(.+)$/gm)].map((match) => match[1]).filter((path) => path !== '/dev/null');
  if (!paths.length) throw new Error('patch_has_no_files');
  for (const path of paths) {
    if (path.includes('..')) throw new Error(`patch_path_forbidden:${path}`);
    if (PROTECTED_PATHS.some((protectedPath) => path.includes(protectedPath))) throw new Error(`patch_path_forbidden:${path}`);
    if (!ALLOWED_PATCH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))) throw new Error(`patch_path_forbidden:${path}`);
  }
  return paths;
}

export function safeTests(requested) {
  const values = Array.isArray(requested) ? requested.map((value) => String(value).trim()).filter(Boolean) : [];
  const selected = values.filter((value) => SAFE_TESTS.has(value));
  if (!selected.includes('npm run test:unit')) selected.push('npm run test:unit');
  if (!selected.includes('npm run typecheck')) selected.push('npm run typecheck');
  return [...new Set(selected)].slice(0, 4);
}

function runValidation(command) {
  const [program, ...args] = command.split(' ');
  console.log(`ATLAS repair validation: ${command}`);
  exec(program, args, { stdio: 'inherit' });
}

async function createPullRequest(branch, summary, risk) {
  const token = process.env.GITHUB_TOKEN || '';
  if (!token) throw new Error('github_token_missing_for_pull_request');
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `fix: ATLAS automated repair ${branch.replace(/^atlas\/repair-/, '')}`,
      head: branch,
      base: 'main',
      body: `## ATLAS Manager automated repair\n\n${summary || 'Bounded repair generated from a queued ATLAS repair job.'}\n\n## Risk\n${risk || 'No additional risk statement was supplied.'}\n\nThis PR was generated by the canonical ATLAS repair executor. It does not bypass review, consensus, or production gates.`,
      draft: true,
    }),
  });
  const data = await responseJson(response);
  return data?.html_url || data?.url || '';
}

async function complete(token, jobId, body) {
  try { await bridge('complete', token, { job_id: jobId, ...body }); }
  catch (error) { console.error(`ATLAS repair completion reporting failed: ${error.message}`); }
}

async function main() {
  const token = await oidcToken();
  const claim = await bridge('claim', token, {});
  const job = claim?.job;
  if (!job) {
    console.log('ATLAS repair queue is empty.');
    return;
  }

  const jobId = String(job.id || '');
  if (!jobId) throw new Error('repair_job_id_missing');

  try {
    const repositoryContext = collectRepositoryContext(job);
    const planned = await bridge('plan', token, { job_id: jobId, repository_context: repositoryContext });
    const plan = planned?.plan || {};
    const patch = String(plan.patch || '');
    validatePatch(patch);
    const tests = safeTests(plan.tests);

    const branch = `atlas/repair-${jobId.slice(0, 8)}-${process.env.GITHUB_RUN_ID || Date.now()}`;
    exec('git', ['checkout', '-b', branch]);

    const tempDir = mkdtempSync(join(tmpdir(), 'atlas-repair-'));
    const patchFile = join(tempDir, 'repair.patch');
    try {
      writeFileSync(patchFile, patch, 'utf8');
      console.log(APPLY_CHECK);
      exec('git', ['apply', '--check', patchFile]);
      exec('git', ['apply', patchFile]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }

    const changed = exec('git', ['status', '--porcelain']);
    if (!changed) throw new Error('repair_patch_made_no_changes');

    console.log('ATLAS repair job claimed; installing locked dependencies for validation.');
    exec('npm', ['ci'], { stdio: 'inherit' });
    for (const command of tests) runValidation(command);

    exec('git', ['config', 'user.name', 'atlas-manager[bot]']);
    exec('git', ['config', 'user.email', 'atlas-manager@users.noreply.github.com']);
    exec('git', ['add', '-A']);
    exec('git', ['commit', '-m', `fix: apply ATLAS repair ${jobId.slice(0, 8)}`]);
    const commit = exec('git', ['rev-parse', 'HEAD']);
    exec('git', ['push', '--set-upstream', 'origin', branch], { stdio: 'inherit' });
    const pullRequestUrl = await createPullRequest(branch, plan.summary, plan.risk);

    await complete(token, jobId, {
      success: true,
      branch,
      pull_request_url: pullRequestUrl,
      commit,
      result: { tests, changed_files: validatePatch(patch), planner: planned?.planner || null },
    });
    console.log(`ATLAS repair PR created: ${pullRequestUrl}`);
  } catch (error) {
    await complete(token, jobId, {
      success: false,
      result: { error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`ATLAS repair executor failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

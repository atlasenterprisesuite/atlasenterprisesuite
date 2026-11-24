import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CANONICAL_REPOSITORY = 'atlasenterprisesuite/atlasenterprisesuite';
const RULESET_ID = 22915870;

export const REQUIRED_CHECKS = Object.freeze([
  'ATLAS 3-of-3 Consensus',
  'verify-build-readiness',
  'github-security-baseline',
  'Analyze (actions)',
  'Analyze (javascript-typescript)',
  'Analyze (python)',
]);

// Pure policy evaluation: no network calls or privileged mutations.
export function assessRuleset({ repository, branch, ruleset } = {}) {
  const blocking = [];
  const advisory = [];
  const fail = message => blocking.push(message);
  const warn = message => advisory.push(message);

  if (!repository || repository.full_name !== CANONICAL_REPOSITORY ||
      repository.default_branch !== 'main') {
    fail('Canonical repository identity or default branch is not verified');
  }
  if (!branch || branch.name !== 'main' || branch.protected !== true) {
    fail('The main branch is not protected or protection cannot be verified');
  }
  const sha = branch?.commit?.sha;
  if (!/^[0-9a-f]{40}$/i.test(sha || '')) {
    fail('Exact main commit SHA is unavailable');
  }

  if (!ruleset || ruleset.id !== RULESET_ID) {
    fail('Canonical ruleset 22915870 is unavailable or changed');
    return { pass: false, blocking, advisory, sha: sha || null };
  }
  if (ruleset.enforcement !== 'active') {
    fail('Ruleset is not actively enforced');
  }
  const targets = ruleset.conditions?.ref_name?.include;
  if (!Array.isArray(targets) ||
      !targets.some(ref => ref === '~DEFAULT_BRANCH' || ref === 'refs/heads/main')) {
    fail('Ruleset does not target the default branch');
  }

  // Unknown bypass identities are never silently trusted.
  if (!Array.isArray(ruleset.bypass_actors)) {
    fail('Ruleset bypass actor inventory is unavailable');
  } else {
    for (const actor of ruleset.bypass_actors) {
      if (actor.bypass_mode === 'always') {
        fail('Permanent ruleset bypass: ' + actor.actor_type + ' ' + actor.actor_id);
      } else {
        warn('Review scoped ruleset bypass: ' + actor.actor_type + ' ' + actor.actor_id +
          ' (' + actor.bypass_mode + ')');
      }
    }
  }

  const rules = Array.isArray(ruleset.rules) ? ruleset.rules : [];
  const find = type => rules.find(rule => rule.type === type);
  for (const type of ['deletion', 'non_fast_forward']) {
    if (!find(type)) fail('Required branch protection missing: ' + type);
  }
  const pull = find('pull_request');
  if (!pull) {
    fail('Pull request enforcement is missing');
  } else {
    const p = pull.parameters || {};
    if (p.required_review_thread_resolution !== true) {
      fail('Unresolved review threads are not required to be resolved');
    }
    if (p.dismiss_stale_reviews_on_push !== true) {
      fail('Stale reviews are not dismissed on push');
    }
    if (!Number.isInteger(p.required_approving_review_count) ||
        p.required_approving_review_count < 1) {
      warn('No independent human approval is required; provision reviewers before requiring one');
    }
    if (p.require_code_owner_review !== true) {
      warn('CODEOWNERS review is not mandatory');
    }
  }

  const status = find('required_status_checks')?.parameters;
  if (!status || status.strict_required_status_checks_policy !== true) {
    fail('Strict required status checks are not configured');
  }
  const actualChecks = new Set((status?.required_status_checks || []).map(x => x.context));
  for (const required of REQUIRED_CHECKS) {
    if (!actualChecks.has(required)) fail('Required status check missing: ' + required);
  }

  const codeql = find('code_scanning')?.parameters?.code_scanning_tools?.find(x => x.tool === 'CodeQL');
  if (!codeql || codeql.security_alerts_threshold !== 'high_or_higher') {
    fail('CodeQL high-severity merge protection is missing');
  } else if (codeql.alerts_threshold !== 'errors_and_warnings') {
    warn('CodeQL alerts_threshold should be errors_and_warnings');
  }
  if (find('copilot_code_review')?.parameters?.review_on_push === true) {
    warn('Automatic Copilot review remains enabled; validate the external review service');
  }

  return { pass: blocking.length === 0, blocking, advisory, sha: sha || null };
}

function report(result) {
  const lines = [
    '## ATLAS GitHub live ruleset audit',
    '',
    '- Result: ' + (result.pass ? 'P0 PASS' : 'P0 BLOCKED'),
    '- Canonical ruleset: ' + RULESET_ID,
    '- Main SHA: ' + (result.sha || 'unknown'),
    '',
    '### P0 blockers',
    ...(result.blocking.length ? result.blocking.map(x => '- ' + x) : ['- None']),
    '',
    '### P1 follow-ups',
    ...(result.advisory.length ? result.advisory.map(x => '- ' + x) : ['- None']),
    '',
    'No ruleset or app permissions were changed by this audit.',
  ];
  return lines.join('\n') + '\n';
}

async function githubGet(path, token) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'atlas-live-ruleset-audit',
  };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch('https://api.github.com' + path, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error('GitHub API ' + response.status + ' while reading ' + path);
  }
  return await response.json();
}

async function main() {
  let result;
  try {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    const scope = process.env.GITHUB_REPOSITORY || CANONICAL_REPOSITORY;
    if (scope !== CANONICAL_REPOSITORY) {
      throw new Error('Refusing to inspect non-canonical repository ' + scope);
    }
    const base = '/repos/' + CANONICAL_REPOSITORY;
    const [repository, branch, ruleset] = await Promise.all([
      githubGet(base),
      githubGet(base + '/branches/main'),
      githubGet(base + '/rulesets/' + RULESET_ID),
    ]);
    result = assessRuleset({ repository, branch, ruleset });
  } catch (error) {
    result = {
      pass: false,
      sha: null,
      blocking: ['Live ruleset verification unavailable: ' + error.message],
      advisory: [],
    };
  }

  const markdown = report(result);
  process.stdout.write(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
  if (!result.pass) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const COPILOT_REVIEWER = 'copilot-pull-request-reviewer[bot]';
export const REQUESTED_EFFORT = 'balanced';

function isCopilot(item) {
  const login = String(item?.user?.login || '').toLowerCase();
  return login === COPILOT_REVIEWER || login === 'copilot-pull-request-reviewer';
}
function clean(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function observedEffort(value) {
  const effort = String(value || '').toLowerCase();
  return ['lite', 'balanced', 'max'].includes(effort) ? effort : 'effort_unconfirmed';
}

export function normalizeCopilotReviewEvidence({
  repository,
  prNumber,
  headSha,
  requested = false,
  requestError = null,
  reviews = [],
  comments = [],
  observedReviewEffort = null,
} = {}) {
  const exactReviews = (Array.isArray(reviews) ? reviews : []).filter(
    (review) => isCopilot(review) && clean(review?.commit_id) === headSha
  );
  const staleReviews = (Array.isArray(reviews) ? reviews : []).filter(
    (review) => isCopilot(review) && clean(review?.commit_id) && clean(review?.commit_id) !== headSha
  );
  const exactComments = (Array.isArray(comments) ? comments : []).filter((comment) => {
    if (!isCopilot(comment)) return false;
    const commit = clean(comment?.commit_id) || clean(comment?.original_commit_id);
    return commit === headSha;
  });
  const completed = exactReviews.length > 0;
  const unavailable = Boolean(requestError);
  const findings = exactComments.map((comment) => ({
    finding_id: String(comment.id),
    path: clean(comment.path),
    line: Number.isFinite(Number(comment.line)) ? Number(comment.line) : null,
    severity: 'unclassified',
    review_effort: observedEffort(observedReviewEffort),
    status: 'open',
    body: String(comment.body || ''),
    evidence_timestamp: clean(comment.updated_at) || clean(comment.created_at),
  }));
  return {
    repository: String(repository || ''),
    pr_number: Number(prNumber),
    head_sha: String(headSha || ''),
    requested: requested === true,
    requested_effort: REQUESTED_EFFORT,
    observed_effort: observedEffort(observedReviewEffort),
    completed,
    stale: !completed && staleReviews.length > 0,
    status: unavailable ? 'unavailable' : completed ? 'completed' : requested ? 'pending' : 'not_requested',
    request_error: requestError || null,
    findings,
    authoritative: false,
    blocking_decision: 'advisory',
  };
}

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
async function api(path, { method = 'GET', body } = {}) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw Object.assign(new Error('github_token_required'), { code: 'github_token_required' });
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2026-03-10',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}
function writeEvidence(evidence, output) {
  const text = `${JSON.stringify(evidence, null, 2)}\n`;
  if (output) writeFileSync(output, text, 'utf8');
  process.stdout.write(text);
}

async function requestReview({ repository, prNumber, headSha, output }) {
  const [owner, repo] = repository.split('/');
  let requested = false;
  let requestError = null;
  try {
    const { response } = await api(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/requested_reviewers`, {
      method: 'POST',
      body: { reviewers: [COPILOT_REVIEWER] },
    });
    if (response.ok) requested = true;
    else requestError = [403, 404, 422].includes(response.status) ? 'copilot_review_unavailable' : `github_http_${response.status}`;
  } catch (error) {
    requestError = error?.code || 'copilot_review_unavailable';
  }
  const evidence = normalizeCopilotReviewEvidence({ repository, prNumber, headSha, requested, requestError });
  writeEvidence(evidence, output);
  return evidence;
}

async function collectReview({ repository, prNumber, headSha, output, requested = true }) {
  const [owner, repo] = repository.split('/');
  let requestError = null;
  let reviews = [];
  let comments = [];
  try {
    const prResult = await api(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`);
    if (!prResult.response.ok) throw Object.assign(new Error('pull_request_unavailable'), { code: `github_http_${prResult.response.status}` });
    if (String(prResult.data?.head?.sha || '') !== headSha) requestError = 'pr_head_moved';
    const reviewResult = await api(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/reviews?per_page=100`);
    const commentResult = await api(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/comments?per_page=100`);
    if (reviewResult.response.ok && Array.isArray(reviewResult.data)) reviews = reviewResult.data;
    if (commentResult.response.ok && Array.isArray(commentResult.data)) comments = commentResult.data;
    if (!reviewResult.response.ok || !commentResult.response.ok) requestError = requestError || 'copilot_review_evidence_unavailable';
  } catch (error) {
    requestError = requestError || error?.code || 'copilot_review_evidence_unavailable';
  }
  const evidence = normalizeCopilotReviewEvidence({ repository, prNumber, headSha, requested, requestError, reviews, comments });
  writeEvidence(evidence, output);
  return evidence;
}

async function main() {
  const command = process.argv[2];
  const repository = arg('repo', process.env.GITHUB_REPOSITORY);
  const prNumber = Number(arg('pr', process.env.PR_NUMBER));
  const headSha = arg('head', process.env.PR_HEAD_SHA);
  const output = arg('output', null);
  if (!repository || !Number.isInteger(prNumber) || prNumber < 1 || !headSha) throw new Error('repo_pr_head_required');
  if (command === 'request') return requestReview({ repository, prNumber, headSha, output });
  if (command === 'collect') return collectReview({ repository, prNumber, headSha, output, requested: true });
  throw new Error('command_must_be_request_or_collect');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}

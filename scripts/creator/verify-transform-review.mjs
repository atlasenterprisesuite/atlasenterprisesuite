/**
 * Fail closed: do not accept a self-asserted review in the JSON manifest.
 * Require a GitHub APPROVED review by another authorized writer, tied to exact PR head.
 */
const token = process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const pr = process.env.ATLAS_PR_NUMBER;
const head = process.env.ATLAS_PR_HEAD_SHA;
const author = process.env.ATLAS_PR_AUTHOR;
function deny(reason) { console.error('ATLAS_TRANSFORM_REVIEW_P0: ' + reason); process.exitCode = 1; }
const valid = token && /^[\w.-]+\/[\w.-]+$/.test(repository || '')
  && /^\d+$/.test(pr || '') && /^[a-f0-9]{40}$/.test(head || '')
  && /^[\w-]+$/.test(author || '') && process.env.GITHUB_EVENT_NAME === 'pull_request';
if (!valid) {
  deny('not a fully identified PR review context');
} else {
  const headers = { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
  try {
    const reviews = [];
    for (let page = 1; page <= 10; page++) {
      const url = `https://api.github.com/repos/${repository}/pulls/${pr}/reviews?per_page=100&page=${page}`;
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('GitHub review API returned ' + response.status);
      const batch = await response.json();
      if (!Array.isArray(batch)) throw new Error('Unexpected review API response');
      reviews.push(...batch);
      if (batch.length < 100) break;
    }
    // Approval belongs to the live GitHub event, not the tracked manifest.
    // Confirm the actual open PR and exact HEAD to avoid stale SHA claims.
    const prResponse = await fetch(`https://api.github.com/repos/${repository}/pulls/${pr}`, { headers });
    if (!prResponse.ok) throw new Error('GitHub PR lookup returned ' + prResponse.status);
    const livePr = await prResponse.json();
    if (livePr.state !== 'open' || livePr.head?.sha !== head) {
      throw new Error('PR not open or HEAD mismatch');
    }
    const latestByReviewer = new Map();
    for (const review of reviews) {
      const login = review.user?.login?.toLowerCase();
      if (!login || login === author.toLowerCase() || review.user.type === 'Bot') continue;
      if (review.commit_id !== head) continue;
      if (!['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(review.state)) continue;
      const previous = latestByReviewer.get(login);
      if (!previous || Date.parse(review.submitted_at || '') >= Date.parse(previous.submitted_at || '')) {
        latestByReviewer.set(login, review);
      }
    }
    const matches = [...latestByReviewer.values()].filter(review => review.state === 'APPROVED');
    let approved = false;
    for (const review of matches) {
      const permission = await fetch(`https://api.github.com/repos/${repository}/collaborators/${encodeURIComponent(review.user.login)}/permission`, { headers });
      if (!permission.ok) continue;
      const body = await permission.json();
      if (['write', 'maintain', 'admin'].includes(body.permission)) { approved = true; break; }
    }
    if (!approved) {
      deny('missing independent authorized writer approval on exact PR head');
    } else {
      console.log('ATLAS_TRANSFORM_INDEPENDENT_REVIEW_GATE: PASS');
    }
  } catch (error) { deny(error instanceof Error ? error.message : 'review verification failed'); }
}

// ATLAS 777 GitHub Actions worker — safe, durable issue queue MVP.
// Processes only explicitly labeled issues. No code generation, merging,
// deployment, migrations, billing, or telecom activation.
const api = process.env.GITHUB_API_URL || 'https://api.github.com';
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const dryRun = process.env.ATLAS_777_DRY_RUN !== 'false';
const maxJobs = 10;
if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !token) {
  throw new Error('Missing or invalid GitHub Actions identity');
}
async function request(path, options = {}) {
  const response = await fetch(api + path, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28', ...options.headers }
  });
  if (!response.ok) throw new Error('GitHub API ' + response.status + ' for ' + path);
  if (response.status === 204) return null;
  return response.json();
}
const base = '/repos/' + repository;
const queue = await request(base + '/issues?state=open&labels=atlas-777-queued&per_page=' + maxJobs);
for (const issue of queue.filter((item) => !item.pull_request)) {
  const marker = '<!-- atlas-777-worker:v1:issue-' + issue.number + ' -->';
  const comments = await request(base + '/issues/' + issue.number + '/comments?per_page=100');
  if (comments.some((comment) => comment.body?.includes(marker))) {
    console.log('Already inspected issue #' + issue.number);
    continue;
  }
  // Read-only evidence gathering; no untrusted issue-body instructions are executed.
  const summary = 'ATLAS 777 inspected this queued issue. No privileged action was performed. '
    + 'Worker remains observation-only; human review required before enabling execution.';
  if (dryRun) {
    console.log('[DRY RUN] #' + issue.number + ': ' + summary);
    continue;
  }
  await request(base + '/issues/' + issue.number + '/comments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: marker + '\n' + summary })
  });
  console.log('Inspected issue #' + issue.number);
}
console.log('ATLAS 777 worker complete; dryRun=' + dryRun + '; inspected=' + queue.length);

'use strict';

const PR_BRIDGE_URL = 'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-github-pr-bridge?api=create-draft';
const PR_BRIDGE_AUDIENCE = 'atlas-github-pr-bridge';

const BLOCKING_LABELS = new Set([
  'review:human-required',
  'security:sensitive',
  'production:mutation',
  'priority:p0',
]);

function labelNames(issue) {
  return (issue.labels || [])
    .map((label) => (typeof label === 'string' ? label : label.name))
    .filter(Boolean);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[—–]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'work';
}

function branchNameFor(issue) {
  return 'atlas/issue-' + issue.number + '-' + slugify(issue.title);
}

function isAutoEligible(issue) {
  const labels = new Set(labelNames(issue));
  return issue.state === 'open'
    && !issue.pull_request
    && labels.has('execution:auto-eligible')
    && ![...BLOCKING_LABELS].some((label) => labels.has(label));
}

async function ensureLabel(github, owner, repo, name, color, description) {
  try {
    await github.rest.issues.getLabel({ owner, repo, name });
  } catch (error) {
    if (error.status !== 404) throw error;
    await github.rest.issues.createLabel({ owner, repo, name, color, description });
  }
}

async function removeLabelIfPresent(github, owner, repo, issueNumber, name) {
  try {
    await github.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: issueNumber,
      name,
    });
  } catch (error) {
    if (error.status !== 404) throw error;
  }
}

async function upsertMarkerComment(github, owner, repo, issueNumber, marker, body) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });
  const existing = comments.find((comment) =>
    typeof comment.body === 'string' && comment.body.includes(marker)
  );
  if (existing) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    return existing.id;
  }
  const created = await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
  return created.data.id;
}

async function findOpenPull(github, owner, repo, branchName) {
  const pulls = await github.rest.pulls.list({
    owner,
    repo,
    head: owner + ':' + branchName,
    state: 'open',
    per_page: 10,
  });
  return pulls.data[0] || null;
}

async function createDraftPull({ github, core, owner, repo, issue, branchName, defaultBranch }) {
  const title = '[AUTO][#' + issue.number + '] ' + issue.title;
  const body = [
    'Tracks #' + issue.number + '.',
    '',
    'ATLAS Director created this draft PR as the governed workspace for the auto-eligible issue.',
    '',
    '- The source issue remains the requirements source of truth.',
    '- Codex/ATLAS Director may implement on this branch according to routing metadata.',
    '- This draft PR is not completion evidence.',
    '- Do not mark ready or merge until implementation, tests, review, and required governance gates pass.',
    '- Production deployment remains a separate authorized step.',
  ].join('\n');

  try {
    const created = await github.rest.pulls.create({
      owner,
      repo,
      title,
      head: branchName,
      base: defaultBranch,
      draft: true,
      body,
    });
    return created.data;
  } catch (error) {
    const message = String(error?.message || '');
    if (error?.status !== 403 || !message.includes('not permitted to create or approve pull requests')) {
      throw error;
    }
  }

  const oidc = await core.getIDToken(PR_BRIDGE_AUDIENCE);
  const response = await fetch(PR_BRIDGE_URL, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + oidc,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      issue_number: issue.number,
      head: branchName,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.ok !== true || !Number.isInteger(Number(result?.pull_request?.number))) {
    const code = String(result?.error || 'github_pr_bridge_failed');
    const bridgeError = new Error('github_pr_bridge_failed:' + code);
    bridgeError.status = response.status;
    throw bridgeError;
  }

  const pull = await github.rest.pulls.get({
    owner,
    repo,
    pull_number: Number(result.pull_request.number),
  });
  return pull.data;
}

async function ensureDraft(github, pull) {
  if (!pull || pull.draft) return;
  const mutation = [
    'mutation($pullRequestId: ID!) {',
    '  convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {',
    '    pullRequest { id isDraft }',
    '  }',
    '}',
  ].join('\n');
  await github.graphql(mutation, { pullRequestId: pull.node_id });
}

async function run({ github, context, core, issueNumber }) {
  if (!Number.isInteger(issueNumber) || issueNumber < 1) {
    core.setFailed('ATLAS auto-work bootstrap requires a valid issue number.');
    return;
  }

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const issueResponse = await github.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });
  const issue = issueResponse.data;
  const branchName = branchNameFor(issue);
  let pull = await findOpenPull(github, owner, repo, branchName);
  const eligible = isAutoEligible(issue);

  await ensureLabel(
    github,
    owner,
    repo,
    'work:bootstrapped',
    '0969da',
    'ATLAS Director created a governed working branch and draft PR.',
  );
  await ensureLabel(
    github,
    owner,
    repo,
    'work:blocked',
    'd1242f',
    'Automatic work remains draft and blocked pending governance review.',
  );

  if (!eligible) {
    if (pull) {
      await ensureDraft(github, pull);
      await ensureLabel(
        github,
        owner,
        repo,
        'review:human-required',
        'd1242f',
        'Human review is required before sensitive execution or completion.',
      );
      await github.rest.issues.addLabels({
        owner,
        repo,
        issue_number: pull.number,
        labels: ['review:human-required'],
      });
      await upsertMarkerComment(
        github,
        owner,
        repo,
        pull.number,
        '<!-- atlas-auto-work-governance -->',
        [
          '<!-- atlas-auto-work-governance -->',
          '## ATLAS Auto-Work Governance',
          '',
          'Source issue #' + issueNumber + ' is not currently eligible for automatic execution.',
          'This PR is forced to remain a draft until the source issue no longer requires human review.',
        ].join('\n'),
      );
      await github.rest.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: ['work:blocked'],
      });
    }

    core.summary
      .addHeading('ATLAS Auto-Work Bootstrap')
      .addRaw('Issue #' + issueNumber + ' is not auto-eligible; no new branch or PR was created.')
      .write();
    return;
  }

  await removeLabelIfPresent(github, owner, repo, issueNumber, 'work:blocked');

  const repositoryResponse = await github.rest.repos.get({ owner, repo });
  const defaultBranch = repositoryResponse.data.default_branch;

  let branchExists = true;
  try {
    await github.rest.git.getRef({
      owner,
      repo,
      ref: 'heads/' + branchName,
    });
  } catch (error) {
    if (error.status !== 404) throw error;
    branchExists = false;
  }

  if (!branchExists) {
    const baseRef = await github.rest.git.getRef({
      owner,
      repo,
      ref: 'heads/' + defaultBranch,
    });
    await github.rest.git.createRef({
      owner,
      repo,
      ref: 'refs/heads/' + branchName,
      sha: baseRef.data.object.sha,
    });
  }

  const workOrderPath = 'docs/ops/issue-work/issue-' + issueNumber + '.md';
  let workOrderExists = true;
  try {
    await github.rest.repos.getContent({
      owner,
      repo,
      path: workOrderPath,
      ref: branchName,
    });
  } catch (error) {
    if (error.status !== 404) throw error;
    workOrderExists = false;
  }

  if (!workOrderExists) {
    const labels = labelNames(issue);
    const executor = labels.includes('agent:codex') ? 'Codex' : 'ATLAS Director';
    const workOrder = [
      '# ATLAS Issue #' + issueNumber + ' Work Order',
      '',
      '> Generated by ATLAS Director. This file is execution metadata, not implementation or production evidence.',
      '',
      '- Issue: #' + issueNumber + ' — ' + issue.title,
      '- Source: ' + issue.html_url,
      '- Branch: ' + branchName,
      '- Base: ' + defaultBranch,
      '- Routing labels: ' + labels.join(', '),
      '- Orchestrator: ATLAS Director',
      '- Executor: ' + executor,
      '',
      '## Binding execution',
      '',
      '1. Read AGENTS.md and the source issue before implementation.',
      '2. Reuse existing architecture and authoritative data sources.',
      '3. Execute failing test -> minimal implementation -> focused tests -> full verification.',
      '4. Keep this PR draft until implementation and required reviews are complete.',
      '5. Do not deploy, mutate production, or claim completion from this work-order commit alone.',
      '6. If governance changes to human-required, stop automatic execution and keep the PR draft.',
      '',
      '## Completion evidence',
      '',
      '- [ ] Focused tests',
      '- [ ] Typecheck',
      '- [ ] Unit/integration tests as applicable',
      '- [ ] Production build',
      '- [ ] Security/tenant checks as applicable',
      '- [ ] Review findings resolved',
      '- [ ] Production verification only when separately authorized and required',
      '',
    ].join('\n');

    await github.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: workOrderPath,
      message: 'chore(atlas): bootstrap work order for issue #' + issueNumber,
      content: Buffer.from(workOrder, 'utf8').toString('base64'),
      branch: branchName,
    });
  }

  pull = pull || await findOpenPull(github, owner, repo, branchName);

  if (!pull) {
    try {
      pull = await createDraftPull({
        github,
        core,
        owner,
        repo,
        issue,
        branchName,
        defaultBranch,
      });
    } catch (error) {
      await ensureLabel(
        github,
        owner,
        repo,
        'work:pr-blocked',
        'd1242f',
        'The governed work branch exists but draft PR creation is blocked by repository authorization.',
      );
      await github.rest.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: ['work:pr-blocked'],
      });
      await upsertMarkerComment(
        github,
        owner,
        repo,
        issueNumber,
        '<!-- atlas-auto-work-pr-blocked -->',
        [
          '<!-- atlas-auto-work-pr-blocked -->',
          '## ATLAS Auto-Work PR Blocked',
          '',
          '- **Branch:** ' + branchName,
          '- **State:** Fail-closed',
          '- **Reason:** ' + String(error?.message || 'github_pr_creation_failed').slice(0, 180),
          '',
          'The branch/work-order remain available, but ATLAS will not claim the workspace complete until a draft PR is created.',
        ].join('\n'),
      );
      throw error;
    }
  }

  await removeLabelIfPresent(github, owner, repo, issueNumber, 'work:pr-blocked');
  await removeLabelIfPresent(github, owner, repo, pull.number, 'review:human-required');

  await github.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: ['work:bootstrapped'],
  });

  const issueMarker = '<!-- atlas-auto-work-bootstrap -->';
  await upsertMarkerComment(
    github,
    owner,
    repo,
    issueNumber,
    issueMarker,
    [
      issueMarker,
      '## ATLAS Auto-Work Bootstrap',
      '',
      '- **Orchestrator:** ATLAS Director',
      '- **Branch:** ' + branchName,
      '- **Draft PR:** #' + pull.number,
      '- **Work order:** ' + workOrderPath,
      '- **State:** Bootstrapped — implementation evidence still required',
      '',
      'The branch and draft PR are execution workspaces only. They do not mark this issue completed and do not authorize production deployment.',
    ].join('\n'),
  );

  core.summary
    .addHeading('ATLAS Auto-Work Bootstrap')
    .addRaw('Issue #' + issueNumber + ' -> ' + branchName + ' -> draft PR #' + pull.number)
    .write();
}

module.exports = run;
module.exports.labelNames = labelNames;
module.exports.slugify = slugify;
module.exports.branchNameFor = branchNameFor;
module.exports.isAutoEligible = isAutoEligible;
module.exports.createDraftPull = createDraftPull;

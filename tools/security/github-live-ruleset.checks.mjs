import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRuleset, REQUIRED_CHECKS } from '../../../scripts/verify-github-live-ruleset.mjs';

function compliant() {
  return {
    repository: { full_name: 'atlasenterprisesuite/atlasenterprisesuite', default_branch: 'main' },
    branch: { name: 'main', protected: true, commit: { sha: 'a'.repeat(40) } },
    ruleset: {
      id: 22915870,
      enforcement: 'active',
      conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
      bypass_actors: [],
      rules: [
        { type: 'deletion' },
        { type: 'non_fast_forward' },
        { type: 'pull_request', parameters: {
          required_review_thread_resolution: true,
          dismiss_stale_reviews_on_push: true,
          required_approving_review_count: 0,
          require_code_owner_review: false,
        } },
        { type: 'required_status_checks', parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: REQUIRED_CHECKS.map(context => ({ context })),
        } },
        { type: 'code_scanning', parameters: {
          code_scanning_tools: [{ tool: 'CodeQL', security_alerts_threshold: 'high_or_higher', alerts_threshold: 'errors_and_warnings' }],
        } },
      ],
    },
  };
}

test('compliant canonical protection passes P0 checks with documented P1 reviewer gap', () => {
  const result = assessRuleset(compliant());
  assert.equal(result.pass, true);
  assert.equal(result.blocking.length, 0);
  assert.ok(result.advisory.some(msg => msg.includes('human approval')));
});

test('live October state fails closed on bypass and unresolved review contracts', () => {
  const value = compliant();
  value.ruleset.bypass_actors = [{ actor_id: 946600, actor_type: 'Integration', bypass_mode: 'always' }];
  value.ruleset.rules.find(x => x.type === 'pull_request').parameters.required_review_thread_resolution = false;
  value.ruleset.rules.find(x => x.type === 'pull_request').parameters.dismiss_stale_reviews_on_push = false;
  value.ruleset.rules.push({ type: 'copilot_code_review', parameters: { review_on_push: true } });
  const result = assessRuleset(value);
  assert.equal(result.pass, false);
  assert.ok(result.blocking.some(msg => msg.includes('946600')));
  assert.ok(result.blocking.some(msg => msg.includes('review threads')));
  assert.ok(result.blocking.some(msg => msg.includes('stale reviews')));
  assert.ok(result.advisory.some(msg => msg.includes('Copilot')));
});

test('missing ruleset, missing bypass evidence and unprotected branch fail closed', () => {
  const value = compliant();
  value.branch.protected = false;
  delete value.ruleset.bypass_actors;
  value.ruleset.conditions.ref_name.include = [];
  const result = assessRuleset(value);
  assert.equal(result.pass, false);
  assert.ok(result.blocking.some(msg => msg.includes('not protected')));
  assert.ok(result.blocking.some(msg => msg.includes('bypass actor')));
  assert.ok(result.blocking.some(msg => msg.includes('default branch')));
  assert.equal(assessRuleset({ repository: value.repository, branch: value.branch, ruleset: null }).pass, false);
});

test('missing a required status or CodeQL gate fails closed', () => {
  const value = compliant();
  const check = value.ruleset.rules.find(x => x.type === 'required_status_checks');
  check.parameters.required_status_checks.pop();
  const codeql = value.ruleset.rules.find(x => x.type === 'code_scanning');
  codeql.parameters.code_scanning_tools = [];
  const result = assessRuleset(value);
  assert.equal(result.pass, false);
  assert.ok(result.blocking.some(msg => msg.includes('Analyze (python)')));
  assert.ok(result.blocking.some(msg => msg.includes('CodeQL')));
});

test('unexpected repository identity fails closed', () => {
  const value = compliant();
  value.repository.full_name = 'attacker/different-repo';
  assert.equal(assessRuleset(value).pass, false);
});

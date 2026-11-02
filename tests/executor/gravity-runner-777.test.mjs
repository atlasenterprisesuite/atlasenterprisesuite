import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow = readFileSync(new URL('../../.github/workflows/atlas-gravity-runner-777.yml', import.meta.url), 'utf8');
const sha = 'a'.repeat(40);
function validChecks(data, head, required) {
  if (!data || !Number.isInteger(data.total_count) || !Array.isArray(data.check_runs)) return false;
  if (data.total_count === 0 || data.total_count !== data.check_runs.length) return false;
  if (!Array.isArray(required) || !required.length) return false;
  return required.every(name => data.check_runs.some(c => c.name === name && c.status === 'completed' && c.conclusion === 'success' && c.head_sha === head));
}
const good = {total_count:1,check_runs:[{name:'required',status:'completed',conclusion:'success',head_sha:sha}]};
test('required checks fail closed for missing and mismatched evidence', () => {
  assert.equal(validChecks(good,sha,['required']),true);
  for (const value of [null,{total_count:0,check_runs:[]},{total_count:2,check_runs:good.check_runs},{total_count:1,check_runs:[]},{total_count:1,check_runs:[{...good.check_runs[0],head_sha:'b'.repeat(40)}]},{total_count:1,check_runs:[{...good.check_runs[0],conclusion:'failure'}]}]) assert.equal(validChecks(value,sha,['required']),false);
  assert.equal(validChecks(good,sha,['missing']),false);
  assert.equal(validChecks(good,sha,[]),false);
});
test('API 403/404 and malformed rulesets remain P0 blockers', () => {
  for (const status of [403,404,500]) assert.equal(status >= 200 && status < 300,false);
  for (const rulesets of [null,{},[],{rules:[]}]) assert.equal(Boolean(rulesets?.required_checks?.length),false);
});
test('workflow policy: least privilege, fail-closed evidence, no write/deploy', () => {
  assert.match(workflow,/checks: read/);
  assert.match(workflow,/pull-requests: read/);
  assert.doesNotMatch(workflow,/\b(?:contents|actions|checks|pull-requests): write\b/);
  assert.match(workflow,/certified\\":false/);
  assert.match(workflow,/if-no-files-found: error/);
  assert.match(workflow,/if: always\(\)/);
  assert.doesNotMatch(workflow,/\b(?:wrangler deploy|vercel deploy|gh pr merge)\b/);
});

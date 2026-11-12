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
  assert.match(workflow,/if-no-files-found: error/);
  assert.match(workflow,/if: always\(\)/);
  assert.doesNotMatch(workflow,/\b(?:wrangler deploy|vercel deploy|gh pr merge)\b/);
});

import { inspect, requiredFromRulesets, validateChecks } from '../../scripts/gravity-runner-777.mjs';
const details={id:1,rules:[{type:'required_status_checks',parameters:{required_status_checks:[{context:'required'}]}}]};
function mock({error=null, total=1, checkSha=sha, rules=[{id:1,enforcement:'active',target:'branch'}], detailsResponse=details}={}){
 return async path=>{
  if(error && path.includes(error.path)) {const e=new Error('HTTP '+error.status);e.status=error.status;throw e;}
  if(path.includes('/rules/branches/')) return [{ruleset_id:1}];
  if(path.includes('/rulesets/')) return detailsResponse;
  if(path.includes('/rulesets?')) return rules;
  if(path.includes('/pulls/')) return {head:{sha},base:{ref:'main'}};
  if(path.includes('/check-runs?')) return {total_count:total,check_runs:[{name:'required',status:'completed',conclusion:'success',head_sha:checkSha}]};
  throw Error('unexpected path '+path);
 };
}
test('real inspector: required check passes only with exact SHA', async()=>{
 const r=await inspect({api:mock(),repo:'atlasenterprisesuite/atlasenterprisesuite',prs:[976]});
 assert.equal(r[0].head,sha);
});
test('real inspector: 403/404, truncation, mismatch, missing rulesets fail closed',async()=>{
 const bad=[
 {error:{path:'/pulls/',status:403}},
 {error:{path:'/check-runs?',status:404}},
 {error:{path:'/rulesets?',status:403}},
 {total:2},
 {checkSha:'b'.repeat(40)},
 {rules:[]},
 {detailsResponse:{id:1,rules:[]}},
 {detailsResponse:{id:1,rules:[{type:'required_status_checks',parameters:{required_status_checks:[]}}]}}
 ];
 for(const x of bad) await assert.rejects(inspect({api:mock(x),repo:'atlasenterprisesuite/atlasenterprisesuite',prs:[976]}));
});
test('ruleset malformed and absent required checks reject',()=>{
 for(const value of [[],[{}],[{rules:[]}],[{rules:[{type:'required_status_checks',parameters:{required_status_checks:[{}]}}]}]]) assert.throws(()=>requiredFromRulesets(value));
});
test('artifact upload failure is explicitly configured as a failing step',()=>{
 assert.match(workflow,/if-no-files-found: error/);
 assert.match(workflow,/actions\/upload-artifact@v4/);
});

test('applicability API 403/404 blocks exact-SHA certification',async()=>{
 for(const status of [403,404]) await assert.rejects(inspect({api:mock({error:{path:'/rules/branches/',status}}),repo:'atlasenterprisesuite/atlasenterprisesuite',prs:[976]}));
});

import { main } from '../../scripts/gravity-runner-777.mjs';
test('PR gate executes native tests on the exact head and never performs live inspection', () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/);
  assert.match(workflow, /if:.*github\.event_name != 'pull_request'/);
  assert.match(workflow, /persist-credentials: false/);
});
test('unresolved applicable ruleset cannot be silently omitted', async () => {
  const base = mock();
  const api = async path => path.includes('/rules/branches/')
    ? [{ruleset_id:1},{ruleset_id:2}] : base(path);
  await assert.rejects(inspect({api,repo:'atlasenterprisesuite/atlasenterprisesuite',prs:[976]}));
});
test('ledger write failure propagates rather than reporting success', async () => {
  await assert.rejects(main({api:mock(),repo:'atlasenterprisesuite/atlasenterprisesuite',write:()=>{throw Error('artifact write failed');}}), /artifact write failed/);
});
test('coordinated inspection follows all five existing PRs', async () => {
  const results = await inspect({api:mock(),repo:'atlasenterprisesuite/atlasenterprisesuite'});
  assert.deepEqual(results.map(r => r.pr), [976,968,974,979,980]);
});

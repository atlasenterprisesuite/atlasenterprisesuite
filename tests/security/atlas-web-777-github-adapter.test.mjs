import test from 'node:test';
import assert from 'node:assert/strict';
import {collectGitHubEvidence,auditGitHub} from '../../scripts/security/atlas-web-777-github-adapter.mjs';
const SHA='a'.repeat(40);
function fake({drift=false,missing=false,wrongSha=false,wrongRepo=false,failHttp=false}={}) {
  let reads=0;
  return async url=>{
    if(failHttp) return {ok:false,status:403};
    const match=url.match(/pulls\/(\d+)$/);
    if(match) {
      reads++;
      const number=Number(match[1]);
      return {ok:true,json:async()=>({number,state:'open',head:{sha:drift&&reads===2?'b'.repeat(40):SHA,
        repo:{full_name:wrongRepo?'attacker/fork':'atlasenterprisesuite/atlasenterprisesuite'}}})};
    }
    const name='ATLAS 777 Isolated PostgreSQL 17 Runtime';
    const workflow_runs=missing?[]:[{name,id:42,head_sha:wrongSha?'b'.repeat(40):SHA,
      event:'pull_request',status:'completed',conclusion:'success',html_url:'https://github.com/example'}];
    return {ok:true,json:async()=>({total_count:workflow_runs.length,workflow_runs})};
  };
}
test('read-only snapshot always retains independent P0 blockers',async()=>{
  const result=await auditGitHub({fetchImpl:fake()});
  assert.equal(result.ok,false);
  assert.ok(result.blockers.includes('P0_FOUNDATION_NOT_CERTIFIED'));
});
test('rejects forged fork provenance',async()=>assert.match((await auditGitHub({fetchImpl:fake({wrongRepo:true})})).blockers[0],/P0_PR_PROVENANCE/));
test('rejects stale HEAD during collection',async()=>assert.match((await auditGitHub({fetchImpl:fake({drift:true})})).blockers[0],/P0_HEAD_CHANGED/));
test('rejects missing required check',async()=>assert.equal((await auditGitHub({fetchImpl:fake({missing:true})})).ok,false));
test('rejects wrong check SHA',async()=>assert.equal((await auditGitHub({fetchImpl:fake({wrongSha:true})})).ok,false));
test('rejects API failure',async()=>assert.match((await auditGitHub({fetchImpl:fake({failHttp:true})})).blockers[0],/P0_GITHUB_HTTP_403/));
test('rejects untrusted API origin',async()=>assert.rejects(()=>collectGitHubEvidence({baseUrl:'https://attacker.example'}),/P0_UNTRUSTED_API_ORIGIN/));

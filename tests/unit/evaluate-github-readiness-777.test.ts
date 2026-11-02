import { describe, expect, it } from 'vitest';
import { evaluateGitHubReadiness777 } from '../../packages/core/src/evaluateGitHubReadiness777';
const sha='a'.repeat(40),repo='atlasenterprisesuite/atlasenterprisesuite';
const base={repository:repo,expectedRepository:repo,moduleId:'atlas-pay',sha,requiredWorkflows:{unit:'ATLAS Unit CI'}};
const run={repository:repo,head_sha:sha,id:12,status:'completed',conclusion:'success',workflow:'ATLAS Unit CI'};
describe('GitHub evidence provenance boundary',()=>{
  it('accepts exactly matched run but never certifies with P0 open',()=>{
    const result=evaluateGitHubReadiness777({...base,runs:[run]});
    expect(result.verifiedChecks).toContain('unit');
    expect(result.blockers).toContain('P0_OPEN');
    expect(result.certified).toBe(false);
  });
  it('rejects wrong repository or SHA',()=>{
    expect(()=>evaluateGitHubReadiness777({...base,repository:'attacker/repo',runs:[run]})).toThrow('UNTRUSTED_GITHUB_EVIDENCE');
    expect(evaluateGitHubReadiness777({...base,runs:[{...run,head_sha:'b'.repeat(40)}]}).verifiedChecks).not.toContain('unit');
  });
  it('rejects pending, failed and ambiguous evidence',()=>{
    for(const altered of [{...run,status:'in_progress'},{...run,conclusion:'failure'}]){
      expect(evaluateGitHubReadiness777({...base,runs:[altered]}).verifiedChecks).not.toContain('unit');
    }
    expect(evaluateGitHubReadiness777({...base,runs:[run,run]}).verifiedChecks).not.toContain('unit');
  });
  it('rejects absent evidence and invalid run ids',()=>{
    expect(evaluateGitHubReadiness777({...base,runs:[]}).blockers).toContain('UNVERIFIED_UNIT');
    expect(evaluateGitHubReadiness777({...base,runs:[{...run,id:0}]}).verifiedChecks).not.toContain('unit');
  });
});

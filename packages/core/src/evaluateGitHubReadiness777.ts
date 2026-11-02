import { certifyIntegration, type ReadinessResult } from './integrationReadiness777';

export type GitHubRunEvidence777 = {
  repository: string; head_sha: string; id: number;
  status: string; conclusion: string | null; workflow: string;
};
/**
 * Accept only provider-fetched runs from a server-side GitHub API client.
 * Caller MUST verify provider authentication; this function does not accept
 * client-supplied evidence as a trusted source.
 */
export function evaluateGitHubReadiness777(input: {
  repository: string; expectedRepository: string; moduleId: string; sha: string;
  runs: readonly GitHubRunEvidence777[];
  requiredWorkflows: Readonly<Record<string,string>>;
}): ReadinessResult {
  const shaValid = /^[a-f0-9]{40}$/.test(input.sha);
  const repoValid = input.repository === input.expectedRepository && input.repository === 'atlasenterprisesuite/atlasenterprisesuite';
  if (!shaValid || !repoValid || !Array.isArray(input.runs))
    throw new Error('UNTRUSTED_GITHUB_EVIDENCE');
  const checks: Record<string,{sha:string;status:string;conclusion:string;runId:number}> = {};
  for (const [check,workflow] of Object.entries(input.requiredWorkflows)) {
    const matches = input.runs.filter(run => run.repository === input.repository && run.workflow === workflow && run.head_sha === input.sha && Number.isSafeInteger(run.id) && run.id > 0 && run.status === 'completed' && run.conclusion === 'success');
    if (matches.length === 1) checks[check] = {sha:input.sha,status:'completed',conclusion:'success',runId:matches[0].id};
  }
  return certifyIntegration({moduleId:input.moduleId,sha:input.sha,checks,p0Open:true,authorizationRequired:true,authorized:false});
}

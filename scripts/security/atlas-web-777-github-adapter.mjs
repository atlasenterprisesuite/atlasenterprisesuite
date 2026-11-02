// Read-only GitHub evidence collector. Never trusts caller-provided attestations.
// Requires a trusted GitHub API endpoint; does not trigger Actions, merge or deploy.
import { REQUIRED, validate } from './atlas-web-777-validator.mjs';
const OWNER='atlasenterprisesuite', REPO='atlasenterprisesuite';
const SHA=/^[a-f0-9]{40}$/;
export async function collectGitHubEvidence({fetchImpl=fetch,token,baseUrl='https://api.github.com'}={}) {
  if (baseUrl !== 'https://api.github.com') throw Error('P0_UNTRUSTED_API_ORIGIN');
  const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  if(token) headers.Authorization=`Bearer ${token}`;
  async function get(path) {
    const response=await fetchImpl(`${baseUrl}${path}`,{headers,method:'GET',redirect:'error'});
    if(!response.ok) throw Error(`P0_GITHUB_HTTP_${response.status}`);
    return response.json();
  }
  const prs=[];
  for (const number of Object.keys(REQUIRED).map(Number)) {
    const pr=await get(`/repos/${OWNER}/${REPO}/pulls/${number}`);
    if(pr.number!==number || pr.state!=='open' || !SHA.test(pr.head?.sha??'') ||
      pr.head?.repo?.full_name!==`${OWNER}/${REPO}`) throw Error(`P0_PR_PROVENANCE:${number}`);
    const sha=pr.head.sha;
    const data=await get(`/repos/${OWNER}/${REPO}/actions/runs?head_sha=${sha}&per_page=100`);
    if(!Array.isArray(data.workflow_runs) || typeof data.total_count!=='number' ||
      data.total_count>data.workflow_runs.length) throw Error(`P0_RUNS_INCOMPLETE:${number}`);
    const checks=data.workflow_runs.filter(run=>run.head_sha===sha && run.event==='pull_request')
      .map(run=>({name:run.name,sha:run.head_sha,status:run.status,conclusion:run.conclusion,
        runId:run.id,htmlUrl:run.html_url}));
    // Prevent a moving branch from being certified using an earlier HEAD.
    const after=await get(`/repos/${OWNER}/${REPO}/pulls/${number}`);
    if(after.head?.sha!==sha) throw Error(`P0_HEAD_CHANGED_DURING_READ:${number}`);
    prs.push({number,expectedSha:sha,actualSha:sha,checks});
  }
  // These three P0 assertions require independent, verifiable evidence.
  return {source:'github-api-readonly',prs,foundationBootstrapCertified:false,
    rulesetEnforcementCertified:false,revocationCertified:false};
}
export async function auditGitHub(options) {
  try { return validate(await collectGitHubEvidence(options)); }
  catch(error) { return {ok:false,blockers:[String(error.message).startsWith('P0_')?error.message:'P0_GITHUB_EVIDENCE_ERROR']}; }
}

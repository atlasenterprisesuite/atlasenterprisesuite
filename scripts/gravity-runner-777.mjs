import { writeFileSync, mkdirSync } from 'node:fs';
const shaPattern = /^[a-f0-9]{40}$/;
export function requiredFromRulesets(rulesets) {
  if (!Array.isArray(rulesets) || rulesets.length === 0) throw Error('P0: rulesets unavailable');
  const names = new Set();
  for (const r of rulesets) {
    if (!r || !Array.isArray(r.rules)) throw Error('P0: ruleset details missing');
    for (const rule of r.rules) if (rule.type === 'required_status_checks') {
      const checks = rule.parameters?.required_status_checks;
      if (!Array.isArray(checks) || !checks.length) throw Error('P0: required checks missing');
      for (const check of checks) {
        if (typeof check.context !== 'string' || !check.context) throw Error('P0: invalid required check');
        names.add(check.context);
      }
    }
  }
  if (!names.size) throw Error('P0: no required checks established');
  return [...names];
}
export function validateChecks(data, head, required) {
  if (!shaPattern.test(head) || !Array.isArray(required) || !required.length ||
      !Number.isInteger(data?.total_count) || !Array.isArray(data?.check_runs) ||
      data.total_count === 0 || data.total_count !== data.check_runs.length) throw Error('P0: missing or truncated checks');
  for (const name of required) if (!data.check_runs.some(c =>
    c.name === name && c.head_sha === head && c.status === 'completed' && c.conclusion === 'success')) throw Error('P0: required check not successful on exact SHA: '+name);
}
export async function inspect({api, repo, prs=[976,968]}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw Error('P0: invalid repo');
  const rulesets = await api('repos/'+repo+'/rulesets?includes_parents=true');
  if (!Array.isArray(rulesets) || !rulesets.length) throw Error('P0: no rulesets');
  const active = rulesets.filter(r=>r.enforcement==='active' && r.target==='branch');
  if (!active.length || active.some(r=>!Number.isInteger(r.id))) throw Error('P0: active branch rulesets unavailable');
  const detailed = await Promise.all(active.map(r=>api('repos/'+repo+'/rulesets/'+r.id)));
  const results=[];
  for (const pr of prs) {
    const p=await api('repos/'+repo+'/pulls/'+pr);
    const head=p?.head?.sha;
    const base=p?.base?.ref;
    if (!shaPattern.test(head) || !base || !/^[\w.\/-]+$/.test(base)) throw Error('P0: invalid PR SHA or base');
    // GitHub evaluates applicable rules for the target branch. Do not guess from repository-wide rulesets.
    const applicable = await api('repos/'+repo+'/rules/branches/'+encodeURIComponent(base));
    if (!Array.isArray(applicable) || !applicable.length) throw Error('P0: applicable branch rules unavailable');
    const appliedIds = new Set(applicable.map(rule=>rule.ruleset_id));
    if (applicable.some(rule=>!Number.isInteger(rule.ruleset_id))) throw Error('P0: incomplete applicable ruleset identifiers');
    const matching = detailed.filter(rule=>appliedIds.has(rule.id));
    if (!matching.length) throw Error('P0: no matching active rulesets');
    const required=requiredFromRulesets(matching);
    const data=await api('repos/'+repo+'/commits/'+head+'/check-runs?per_page=100');
    validateChecks(data,head,required);
    results.push({pr,head,required});
  }
  return results;
}
export async function main({api,repo,write=writeFileSync}){
  mkdirSync('evidence',{recursive:true});
  const ledger={mode:'read-only',certified:false,p0:'NO-GO',checksVerified:false};
  try {
    ledger.results=await inspect({api,repo});
    ledger.checksVerified=true;
    ledger.blockers=['P0: runtime, revocation and artifact certification not complete'];
  } catch(e) {ledger.blockers=[String(e.message||e)];}
  write('evidence/ledger.json',JSON.stringify(ledger,null,2)+'\n');
  return ledger;
}
if (process.argv[1] && import.meta.url === new URL('file://'+process.argv[1]).href) {
  const {execFileSync}=await import('node:child_process');
  const api=async path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',timeout:20000}));
  const ledger=await main({api,repo:process.env.GH_REPO||''});
  if (!ledger.checksVerified) process.exitCode=1;
}

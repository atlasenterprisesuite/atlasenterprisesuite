import fs from 'node:fs';
import path from 'node:path';

const moduleId = process.env.ATLAS_MODULE || 'global';
if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(moduleId)) {
  console.error('P0: Invalid module identifier');
  process.exit(1);
}
const phases = ['Inventory and diagnosis','Scope and contracts','Reconcile with main','Adapters and services','OAuth and secrets','Audit and RBAC','Unit tests','Integration tests','E2E and security','Pull request','CI','Staging and rollback','Release and deployment','Production verification'];
const dir = path.join('artifacts','atlas-777');
const file = path.join(dir,'ledger.json');
fs.mkdirSync(dir,{recursive:true});
const now = new Date().toISOString();
const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : null;
const evidence = existing || {
  schema_version: 2,
  module: moduleId,
  run_id: process.env.GITHUB_RUN_ID || null,
  sha: process.env.GITHUB_SHA || null,
  generated_at: now,
  status: 'blocked',
  phases: phases.map((name,index)=>({number:index+1,name,status:'unverified',evidence:[]})),
  blockers: ['Production requires verified exact-SHA evidence and authorization']
};
if (evidence.module !== moduleId || evidence.sha !== (process.env.GITHUB_SHA || null)) {
  throw new Error('P0: Ledger identity mismatch');
}
const phase = Number(process.env.ATLAS_PHASE || 0);
if (phase) {
  const allowed = {7:'unit',8:'integration',11:'ci'};
  if (!Object.hasOwn(allowed,phase) || process.env.ATLAS_STEP_RESULT !== 'success') {
    throw new Error('P0: Invalid or unverified phase result');
  }
  const item = evidence.phases[phase-1];
  item.status = 'verified';
  item.verified_at = now;
  item.evidence = [{kind:'github-actions-step',run_id:evidence.run_id,sha:evidence.sha,step:allowed[phase]}];
}
evidence.updated_at = now;
evidence.verified_count = evidence.phases.filter(p=>p.status==='verified').length;
evidence.progress_percent = Math.floor(evidence.verified_count / phases.length * 100);
evidence.status = 'blocked';
fs.writeFileSync(file,JSON.stringify(evidence,null,2)+'\n');
console.log(`ATLAS 777: ${evidence.verified_count}/14 evidence-backed phase checkpoints; production fail-closed.`);

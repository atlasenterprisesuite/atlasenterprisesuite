import fs from 'node:fs';
import path from 'node:path';
const moduleId = process.env.ATLAS_MODULE || 'global';
if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(moduleId)) {
  console.error('P0: Invalid module identifier');
  process.exit(1);
}
const phases = ['Inventory and diagnosis','Scope and contracts','Reconcile with main','Adapters and services','OAuth and secrets','Audit and RBAC','Unit tests','Integration tests','E2E and security','Pull request','CI','Staging and rollback','Release and deployment','Production verification'];
const evidence = {schema_version:1,module:moduleId,run_id:process.env.GITHUB_RUN_ID||null,sha:process.env.GITHUB_SHA||null,generated_at:new Date().toISOString(),status:'blocked',phases:phases.map((name,index)=>({number:index+1,name,status:'unverified'})),blockers:['No production release without verified evidence and authorization']};
const dir=path.join('artifacts','atlas-777');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'ledger.json'),JSON.stringify(evidence,null,2)+'\n');
console.log('ATLAS 777: 0/14 phases verified; evidence ledger created. Production remains fail-closed.');

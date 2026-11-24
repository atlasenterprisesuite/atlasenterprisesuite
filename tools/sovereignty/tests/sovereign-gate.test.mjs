import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import { verifyRelease, P0_CHECKS } from '../sovereign-gate.mjs';
const SHA = 'a'.repeat(40);
function fixture() {
  const dir=mkdtempSync(join(tmpdir(),'atlas-sov-'));
  const evidenceRoot=join(dir,'evidence');
  mkdirSync(evidenceRoot);
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const publicKeyPath=join(dir,'trusted.pem');
  writeFileSync(publicKeyPath,publicKey.export({type:'spki',format:'pem'}));
  const checks={};
  for(const name of P0_CHECKS){
    const content='SYNTHETIC '+name+'\n';
    writeFileSync(join(evidenceRoot,name+'.txt'),content);
    checks[name]={status:'pass',sha:SHA,evidence:{path:name+'.txt',sha256:createHash('sha256').update(content).digest('hex')}};
  }
  const manifest={schema_version:'atlas.sovereignty.v1',release:{sha:SHA,environment:'production',issued_at:new Date().toISOString()},checks};
  const manifestPath=join(dir,'release.json'),signaturePath=join(dir,'release.sig');
  const resave=()=>{
    const bytes=Buffer.from(JSON.stringify(manifest));
    writeFileSync(manifestPath,bytes);
    writeFileSync(signaturePath,sign(null,bytes,privateKey).toString('base64'));
  };
  resave();
  return {dir,evidenceRoot,manifest,manifestPath,signaturePath,publicKeyPath,resave,
    verify:(opts={})=>verifyRelease({manifestPath,signaturePath,publicKeyPath,expectedSha:SHA,evidenceRoot,...opts}),
    close:()=>rmSync(dir,{recursive:true,force:true})};
}
function run(fn){const f=fixture();try{fn(f)}finally{f.close()}}
test('signed synthetic evidence passes but never authorizes deployment',()=>run(f=>{
  const result=f.verify();assert.equal(result.ok,true,JSON.stringify(result.issues));
  assert.equal(result.eligible_for_deployment,false);
}));
test('missing P0 fails closed',()=>run(f=>{
  delete f.manifest.checks.rls_and_rbac;f.resave();
  assert.match(f.verify().issues.join(' '),/rls_and_rbac: missing check/);
}));
test('P0 unverified fails closed',()=>run(f=>{
  f.manifest.checks.backup_restore.status='unknown';f.resave();
  assert.match(f.verify().issues.join(' '),/P0 not passed/);
}));
test('exact commit mismatch fails closed',()=>run(f=>{
  assert.match(f.verify({expectedSha:'b'.repeat(40)}).issues.join(' '),/SHA mismatch/);
}));
test('tampered evidence is rejected',()=>run(f=>{
  writeFileSync(join(f.evidenceRoot,'unit_tests.txt'),'changed');
  assert.match(f.verify().issues.join(' '),/digest mismatch/);
}));
test('tampered signed manifest is rejected',()=>run(f=>{
  writeFileSync(f.manifestPath,readFileSync(f.manifestPath,'utf8').replace('production','staging'));
  assert.match(f.verify().issues.join(' '),/Signature not verified/);
}));
test('missing signature is rejected',()=>run(f=>{
  rmSync(f.signaturePath);
  assert.match(f.verify().issues.join(' '),/Signature not verified/);
}));
test('traversal is rejected',()=>run(f=>{
  f.manifest.checks.unit_tests.evidence.path='../outside';f.resave();
  assert.match(f.verify().issues.join(' '),/unsafe evidence/);
}));
test('symlink escape is rejected',()=>run(f=>{
  const outside=join(f.dir,'outside');writeFileSync(outside,'outside');
  rmSync(join(f.evidenceRoot,'unit_tests.txt'));
  symlinkSync(outside,join(f.evidenceRoot,'unit_tests.txt'));
  assert.match(f.verify().issues.join(' '),/unsafe evidence/);
}));
test('stale signature is rejected',()=>run(f=>{
  f.manifest.release.issued_at=new Date(Date.now()-172800000).toISOString();f.resave();
  assert.match(f.verify().issues.join(' '),/expired/);
}));
test('unknown signing key is rejected',()=>run(f=>{
  const {publicKey}=generateKeyPairSync('ed25519');
  const wrong=join(f.dir,'wrong.pem');writeFileSync(wrong,publicKey.export({type:'spki',format:'pem'}));
  assert.match(f.verify({publicKeyPath:wrong}).issues.join(' '),/Invalid detached signature/);
}));

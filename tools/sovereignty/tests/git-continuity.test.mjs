import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { exportSource, verifySource, restoreSource } from '../git-continuity.mjs';
function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, ...args], {encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}
function fixture() {
  const dir=mkdtempSync(join(tmpdir(),'atlas-continuity-'));
  const repo=join(dir,'source'); mkdirSync(repo);
  git(repo,'init','--quiet','-b','main');
  git(repo,'config','user.email','test@invalid.example');
  git(repo,'config','user.name','ATLAS Test');
  writeFileSync(join(repo,'app.txt'),'SOV-002 sample source\n');
  git(repo,'add','app.txt'); git(repo,'commit','--quiet','-m','initial');
  const expectedSha=git(repo,'rev-parse','HEAD');
  const bundle=join(dir,'sealed','atlas-source.bundle');
  const manifest=bundle+'.json';
  return {
    dir,repo,bundle,manifest,expectedSha,
    create:()=>exportSource({repo,bundle,expectedSha}),
    verify:()=>verifySource({bundle,manifest,expectedSha}),
    restore:(destination=join(dir,'recovered'))=>restoreSource({bundle,manifest,expectedSha,destination}),
    close:()=>rmSync(dir,{recursive:true,force:true})
  };
}
function run(fn){const f=fixture();try{fn(f)}finally{f.close()}}
test('self-contained main Git bundle can be created and verified offline',()=>run(f=>{
  const exported=f.create();assert.equal(exported.source_bundle_created,true);
  const validated=f.verify();assert.equal(validated.source_bundle_verified,true);
  assert.equal(validated.runtime_or_data_recovery_verified,false);
}));
test('source can be cloned offline at the exact commit, but not certified as runtime',()=>run(f=>{
  f.create();const result=f.restore();
  assert.equal(result.source_restore_verified,true);
  assert.equal(result.runtime_or_data_recovery_verified,false);
  assert.equal(git(join(f.dir,'recovered'),'rev-parse','HEAD'),f.expectedSha);
  assert.equal(readFileSync(join(f.dir,'recovered','app.txt'),'utf8'),'SOV-002 sample source\n');
}));
test('export refuses dirty worktree',()=>run(f=>{
  writeFileSync(join(f.repo,'app.txt'),'modified\n');
  assert.throws(f.create,/Worktree must be clean/);
}));
test('export refuses divergent exact SHA',()=>run(f=>{
  assert.throws(()=>exportSource({repo:f.repo,bundle:f.bundle,expectedSha:'f'.repeat(40)}),/differ/);
}));
test('export refuses writing backup inside source tree',()=>run(f=>{
  assert.throws(()=>exportSource({repo:f.repo,bundle:join(f.repo,'backup.bundle'),expectedSha:f.expectedSha}),/outside/);
}));
test('bundle cannot be silently overwritten',()=>run(f=>{
  f.create();assert.throws(f.create,/already exists/);
}));
test('altered bundle is rejected before clone',()=>run(f=>{
  f.create();writeFileSync(f.bundle,readFileSync(f.bundle).subarray(1));
  assert.throws(f.verify,/mismatch/);
}));
test('tampered manifest sha256 is rejected',()=>run(f=>{
  f.create();const d=JSON.parse(readFileSync(f.manifest,'utf8'));
  d.bundle_sha256='0'.repeat(64);writeFileSync(f.manifest,JSON.stringify(d));
  assert.throws(f.verify,/SHA-256 mismatch/);
}));
test('restore refuses pre-existing destination',()=>run(f=>{
  f.create();const target=join(f.dir,'already');mkdirSync(target);
  assert.throws(()=>f.restore(target),/already exists/);
}));
test('verify does not accept a different expected commit',()=>run(f=>{
  f.create();assert.throws(()=>verifySource({bundle:f.bundle,manifest:f.manifest,expectedSha:'f'.repeat(40)}),/differs/);
}));

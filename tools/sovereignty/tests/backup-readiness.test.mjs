import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkBackup} from '../backup-readiness.mjs';
const SHA='a'.repeat(40);
async function fixture(mutate=()=>{}) {
 const dir=mkdtempSync(join(tmpdir(),'atlas-sov003-'));
 try {
  const contents=Buffer.from('PGDMP synthetic not a real database backup');
  const archivePath=join(dir,'backup.dump'),manifestPath=join(dir,'manifest.json');
  writeFileSync(archivePath,contents);
  const m={schema_version:'atlas.backup-readiness.v1',kind:'postgresql-pgdump-custom',
    source:{environment:'isolated-test',database:'synthetic',commit_sha:SHA},
    created_at:new Date().toISOString(),
    archive:{size_bytes:contents.length,sha256:createHash('sha256').update(contents).digest('hex')}};
  const c={dir,m,archivePath,manifestPath,expectedCommit:SHA};
  mutate(c);writeFileSync(manifestPath,JSON.stringify(m));
  return await checkBackup(c);
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('synthetic metadata passes; restore remains unverified',async()=>{
 const r=await fixture();assert.equal(r.ok,true);assert.equal(r.restore_verified,false);assert.equal(r.production_ready,false);
});
test('tampered digest fails',async()=>assert.ok((await fixture(c=>c.m.archive.sha256='b'.repeat(64))).issues.includes('archive_digest_mismatch')));
test('missing archive fails',async()=>assert.ok((await fixture(c=>c.archivePath=join(c.dir,'absent.dump'))).issues.includes('archive_unreadable')));
test('commit mismatch fails',async()=>assert.ok((await fixture(c=>c.expectedCommit='b'.repeat(40))).issues.includes('commit_mismatch')));
test('production source not permitted',async()=>assert.ok((await fixture(c=>c.m.source.environment='production')).issues.includes('live_environment_not_allowed')));
test('expired timestamp fails',async()=>assert.ok((await fixture(c=>c.m.created_at=new Date(Date.now()-172800000).toISOString())).issues.includes('expired_or_invalid_timestamp')));
test('unsupported format fails',async()=>assert.ok((await fixture(c=>c.m.kind='sql-plain')).issues.includes('unsupported_backup_kind')));
test('bad schema fails',async()=>assert.ok((await fixture(c=>c.m.schema_version='invalid')).issues.includes('wrong_schema')));
test('wrong byte size fails',async()=>assert.ok((await fixture(c=>c.m.archive.size_bytes+=1)).issues.includes('archive_size_mismatch')));
test('symlink backup fails',async()=>assert.ok((await fixture(c=>{
 const alias=join(c.dir,'alias.dump');symlinkSync(c.archivePath,alias);c.archivePath=alias;
})).issues.includes('archive_unreadable')));

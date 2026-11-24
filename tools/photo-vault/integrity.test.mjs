import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256, safeRelativePath, validateManifest, verifyFile, authorizePhotoOperation} from './integrity.mjs';

test('sha256 verifies byte-for-byte copy and detects tampering', () => {
  const bytes = Buffer.from('example-not-a-private-image');
  const item = {path:'photos/a.jpg',sha256:sha256(bytes),bytes:bytes.length};
  assert.deepEqual(validateManifest({schema:1,files:[item]}),{files:1,bytes:bytes.length});
  assert.equal(verifyFile(item, bytes), true);
  assert.equal(verifyFile(item, Buffer.from('tampered')), false);
});
test('refuses traversal, absolute paths, duplicate entries and invalid hashes', () => {
  for (const path of ['../secret','/etc/passwd','a/../b','a//b','a\\b','']) assert.equal(safeRelativePath(path),false);
  const item = {path:'photos/a.jpg',sha256:'0'.repeat(64),bytes:0};
  assert.throws(()=>validateManifest({schema:1,files:[item,item]}),/INVALID_PATH_OR_DUPLICATE/);
  assert.throws(()=>validateManifest({schema:1,files:[{...item,sha256:'bad'}]}),/INVALID_HASH_OR_SIZE/);
});
test('no biometric or backup operations without scoped consent and tenant match', () => {
  const base={authenticated:true,tenantId:'tenant-a',resourceTenantId:'tenant-a',consent:{'face-detect':true},operation:'face-detect'};
  assert.equal(authorizePhotoOperation(base),true);
  assert.equal(authorizePhotoOperation({...base,authenticated:false}),false);
  assert.equal(authorizePhotoOperation({...base,resourceTenantId:'tenant-b'}),false);
  assert.equal(authorizePhotoOperation({...base,consent:{}}),false);
  assert.equal(authorizePhotoOperation({...base,operation:'delete'}),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMediaEnvelope } from '../../supabase/functions/atlas-copilot/multimodal-envelope.mjs';
const valid = {kind:'image',mime_type:'image/png',byte_size:512,storage_ref:'abcdef0123456789',sha256:'a'.repeat(64)};
test('accepts bounded opaque media metadata only', () => {
  assert.deepEqual(validateMediaEnvelope(valid), valid);
});
test('rejects URLs, executable files and oversized inputs', () => {
  for (const input of [
    {...valid,storage_ref:'https://example.com/evil'},
    {...valid,mime_type:'application/x-msdownload'},
    {...valid,byte_size:999999999},
    {...valid,sha256:'not-a-digest'},
  ]) assert.throws(()=>validateMediaEnvelope(input));
});
test('audio/video require explicit consent',()=>{
  for(const kind of ['audio','video']) {
    assert.throws(()=>validateMediaEnvelope({...valid,kind,mime_type:kind==='audio'?'audio/wav':'video/mp4'}), /media_consent_required/);
  }
});
test('rejects unrecognized kinds and malformed input',()=>{
  assert.throws(()=>validateMediaEnvelope({...valid,kind:'tool'}));
  assert.throws(()=>validateMediaEnvelope(null));
});

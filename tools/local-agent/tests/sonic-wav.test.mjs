import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectSonicWav, sonicResultUrl } from '../lib/sonic-wav.mjs';

function fixture() {
  const frames=80000, rate=8000;
  const b=Buffer.alloc(44+frames*2);
  b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);
  b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
  b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);
  b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(frames*2,40);
  for(let i=0;i<frames;i++) b.writeInt16LE(i%2?1000:-1000,44+i*2);
  return b;
}
test('validates actual PCM samples, duration and digest',()=>{
  const b=fixture(), result=inspectSonicWav(b,10);
  assert.equal(result.durationSeconds,10);
  assert.equal(result.sampleRate,8000);
  assert.equal(result.channels,1);
  assert.match(result.sha256,/^[a-f0-9]{64}$/);
  assert.equal(result.audioVerified,true);
  assert.throws(()=>inspectSonicWav(b,30));
  b.fill(0,44);assert.throws(()=>inspectSonicWav(b,10));
});
test('rejects malformed or truncated WAV and invalid alignment',()=>{
  const b=fixture();
  assert.throws(()=>inspectSonicWav(b.subarray(0,b.length-1),10));
  b.writeUInt16LE(4,32);assert.throws(()=>inspectSonicWav(b,10));
});
test('restricts result URL to approved output folder and fixed local origin',()=>{
  const origin='http://127.0.0.1:8001', root='/tmp/api_audio';
  const url=sonicResultUrl('/v1/audio?path=%2Ftmp%2Fapi_audio%2Fabc.wav',origin,root);
  assert.equal(url.origin,origin);
  for(const file of ['https://example.com/v1/audio?path=x','//example.com/v1/audio?path=x','/v1/audio?path=/tmp/api_audio/../secret.wav','/v1/audio?path=/tmp/api_audio/a.wav&path=/tmp/api_audio/b.wav','/v1/audio?path=/tmp/api_audio-evil/a.wav','/v1/audio?path=/tmp/api_audio/a.mp3']) assert.throws(()=>sonicResultUrl(file,origin,root));
});

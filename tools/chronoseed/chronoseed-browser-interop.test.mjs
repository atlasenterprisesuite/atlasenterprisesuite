/** Format-level cross-implementation checks using standalone browser prototype's v1 wire rules.
 * Not a UI/DOM browser E2E test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapsule, openCapsule } from './chronoseed-format.mjs';
const encoder = new TextEncoder();
const decode = new TextDecoder();
const AAD = encoder.encode('ATLAS-CHRONOSEED-V1');
const iterations = 310000;
const password = 'example-only-passphrase-for-testing';
const entries = [
  { title: 'Ñandú 777', content: 'Astronomía 🌌 — original ≠ copia', source: 'Demo local', timestamp: '2026-11-23T00:00:00.000Z' },
  { title: 'Other', content: 'Second selected record', source: '', timestamp: '2026-11-23T00:00:00.000Z' }
];
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const ub64 = string => Uint8Array.from(atob(string), c => c.charCodeAt(0));
const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2,'0')).join('');
async function keyFrom(pass,salt) {
  const material = await crypto.subtle.importKey('raw',encoder.encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function originalHtmlStyleEncrypt(records,pass) {
  const base={schema:'atlas-chronoseed/v1',createdAt:'2026-11-23T00:00:00.000Z',entries:records};
  const digest=await hash(encoder.encode(JSON.stringify(base)));
  const payload=encoder.encode(JSON.stringify({...base,integrity:{algorithm:'SHA-256',digest}}));
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD},await keyFrom(pass,salt),payload));
  const capsule={format:'ATLAS-CHRONOSEED',version:1,createdAt:base.createdAt,kdf:{name:'PBKDF2-SHA256',iterations,salt:b64(salt)},cipher:{name:'AES-256-GCM',iv:b64(iv),data:b64(ciphertext)}};
  return encoder.encode(JSON.stringify(capsule,null,2));
}
async function originalHtmlStyleDecrypt(bytes,pass) {
  const obj=JSON.parse(decode.decode(bytes));
  assert.equal(obj.format,'ATLAS-CHRONOSEED');
  assert.equal(obj.kdf.iterations,iterations);
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:ub64(obj.cipher.iv),additionalData:AAD},await keyFrom(pass,ub64(obj.kdf.salt)),ub64(obj.cipher.data));
  const doc=JSON.parse(decode.decode(plaintext));
  const expected=await hash(encoder.encode(JSON.stringify({schema:doc.schema,createdAt:doc.createdAt,entries:doc.entries})));
  assert.equal(doc.integrity.digest,expected);
  return doc.entries;
}
test('original HTML v1 wire format -> portable codec (Unicode, multiple notes)', async()=>{
  const source=await originalHtmlStyleEncrypt(entries,password);
  const opened=await openCapsule(source,password);
  assert.deepEqual(opened.entries,entries);
});
test('portable codec -> original HTML v1 wire reader',async()=>{
  const capsule=await createCapsule(entries,password,'2026-11-23T00:00:00.000Z');
  assert.deepEqual(await originalHtmlStyleDecrypt(capsule.bytes,password),entries);
});
test('original HTML wire reader rejects wrong password and corrupt ciphertext',async()=>{
  const capsule=await createCapsule(entries,password);
  await assert.rejects(originalHtmlStyleDecrypt(capsule.bytes,'definitely-wrong'),/OperationError|operation failed|decrypt/i);
  const obj=JSON.parse(decode.decode(capsule.bytes));
  obj.cipher.data=(obj.cipher.data.startsWith('A')?'B':'A')+obj.cipher.data.slice(1);
  await assert.rejects(originalHtmlStyleDecrypt(encoder.encode(JSON.stringify(obj)),password),/OperationError|operation failed|decrypt/i);
});

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'apps/reconnect-autofill-extension/dist');
const required = ['manifest.json', 'popup.html', 'content.js'];
for (const file of required) {
  if (!existsSync(resolve(root, file))) throw new Error(`Missing extension output: ${file}`);
}

const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('Manifest must be V3');
if (JSON.stringify(manifest.host_permissions ?? []) !== JSON.stringify(['https://connect.myflorida.com/*'])) {
  throw new Error('Reconnect host permission must be exact and least-privilege');
}
const serialized = JSON.stringify(manifest);
if (serialized.includes('<all_urls>')) throw new Error('Broad host permission is forbidden');
for (const permission of ['storage', 'cookies', 'webRequest']) {
  if ((manifest.permissions ?? []).includes(permission)) throw new Error(`Forbidden permission: ${permission}`);
}
if (manifest.action?.default_popup !== 'popup.html') throw new Error('Popup entry mismatch');
const content = manifest.content_scripts?.[0];
if (JSON.stringify(content?.matches ?? []) !== JSON.stringify(['https://connect.myflorida.com/*'])) {
  throw new Error('Content script host mismatch');
}
if (JSON.stringify(content?.js ?? []) !== JSON.stringify(['content.js'])) throw new Error('Content script output mismatch');

const js = readFileSync(resolve(root, 'content.js'), 'utf8');
if (/\beval\s*\(/.test(js) || /new\s+Function\s*\(/.test(js)) throw new Error('Dynamic code execution is forbidden');

const popup = readFileSync(resolve(root, 'popup.html'), 'utf8');
if (/https?:\/\//i.test(popup)) throw new Error('Popup must not load remote assets or scripts');

console.log('ATLAS Reconnect package verified: MV3, official host only, no persistent storage, no dynamic/external code.');

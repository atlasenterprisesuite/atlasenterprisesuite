// Runs an actual Chromium browser with fake, synthetic camera/microphone tracks.
// No public network APIs, Supabase credentials, user recordings, or deployments.
// A PASS proves the browser media stack only, not a physical iPhone camera.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const html = readFileSync(resolve('tests/fixtures/teleprompter-browser-media-probe.html'), 'utf8');
const timeoutMs = 35000;
let receive;
const resultPromise = new Promise((resolveResult) => { receive = resolveResult; });
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/?autorun=1') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
    return;
  }
  if (req.method === 'POST' && req.url === '/report') {
    let body = '';
    req.on('data', chunk => {
      body += String(chunk);
      if (body.length > 12000) req.destroy();
    });
    req.on('end', () => {
      try {
        const result = JSON.parse(body);
        receive(result);
        res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
        res.end('received');
      } catch {
        res.writeHead(400);
        res.end('invalid report');
      }
    });
    return;
  }
  res.writeHead(404);
  res.end('not found');
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const url = 'http://127.0.0.1:' + server.address().port + '/?autorun=1';
const chrome = process.env.CHROME_BIN || 'google-chrome';
const profile = mkdtempSync(join(tmpdir(), 'atlas-teleprompter-chrome-'));
const args = [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--disable-background-networking', '--disable-extensions', '--no-proxy-server',
  '--no-first-run', '--no-default-browser-check', '--disable-sync',
  '--disable-component-update', '--no-pings',
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
  '--user-data-dir=' + profile, url
];
const child = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] });
let browserError = '';
child.stderr.on('data', chunk => {
  browserError = (browserError + String(chunk)).slice(-4000);
});
const exitPromise = new Promise((_, reject) => {
  child.once('error', error => reject(Error('browser_start_failed:' + error.message)));
  child.once('exit', (code, signal) => reject(Error('browser_exited_before_report:' + code + ':' + signal)));
});
let timer;
const timedOut = new Promise((_, reject) => {
  timer = setTimeout(() => reject(Error('browser_media_probe_timeout')), timeoutMs);
});
try {
  const result = await Promise.race([resultPromise, exitPromise, timedOut]);
  console.log('ATLAS_BROWSER_MEDIA_EVIDENCE=' + JSON.stringify(result));
  if (!result.ok || result.mode !== 'synthetic_browser_media' ||
      !result.secureContext || !result.audioTracks || !result.videoTracks ||
      !result.tracksStopped || result.bytes < 1024 ||
      result.videoWidth < 16 || result.videoHeight < 16) {
    throw Error('browser_media_probe_failed:' + JSON.stringify(result));
  }
  console.log('PASS: Chromium synthetic AV capture, MediaRecorder, playback metadata and track revocation');
} catch (error) {
  process.exitCode = 1;
  console.error('FAIL:', error);
  console.error('Browser diagnostics:', browserError.slice(-1800));
} finally {
  clearTimeout(timer);
  child.kill('SIGTERM');
  await new Promise(resolveClose => server.close(resolveClose));
  rmSync(profile, { recursive: true, force: true });
}

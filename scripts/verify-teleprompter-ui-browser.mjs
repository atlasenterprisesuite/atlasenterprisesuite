// Isolated REAL React Teleprompter UI smoke check in Chromium's fake camera.
// No network egress, no production services, no device claims, no recordings saved.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.VITE_SUPABASE_URL = 'https://synthetic-test.invalid';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'fake-publishable-for-isolated-browser-test';
const devRoot = process.cwd();
let resolveReport;
const resultPromise = new Promise(resolve => { resolveReport = resolve; });
const stub = {
  name: 'atlas-creator-test-isolation',
  enforce: 'pre',
  resolveId(source, importer) {
    if (source === '../../../lib/creatorApi' && importer?.includes('/teleprompter/TeleprompterPage.tsx')) {
      return '\0atlas-creator-api-test-stub';
    }
    return null;
  },
  load(id) {
    if (id !== '\0atlas-creator-api-test-stub') return null;
    return [
      'globalThis.__atlasProbeUploads = 0;',
      "export async function getCreatorRecordingReadiness() { return {ok:true, connected:true, upload_allowed:true, organization_id:'synthetic-org', bucket:'atlas-creator-recordings'}; }",
      'export async function listCreatorRecordings() { return []; }',
      "export async function uploadCreatorRecording() { globalThis.__atlasProbeUploads++; throw Error('cloud_upload_must_not_happen'); }",
      "export async function getCreatorRecordingDownload() { throw Error('no_backend_for_synthetic_media'); }"
    ].join('\n');
  }
};
const middleware = {
  name: 'atlas-teleprompter-browser-harness',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.method === 'GET' && req.url?.startsWith('/__atlas_teleprompter_ui')) {
        const template = `<!doctype html><html><head><meta charset="utf-8"></head><body><main id="root"></main>
<script>
window.addEventListener('error', event => { fetch('/__atlas_teleprompter_ui_report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ok:false,error:'page_error:'+event.message})}).catch(()=>{}); });
window.addEventListener('unhandledrejection', event => { fetch('/__atlas_teleprompter_ui_report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ok:false,error:'unhandled_rejection:'+String(event.reason)})}).catch(()=>{}); });
</script><script type="module" src="/tests/fixtures/teleprompter-real-ui-browser.tsx"></script></body></html>`;
        void server.transformIndexHtml(req.url, template).then(html => {
          res.writeHead(200, {'content-type':'text/html; charset=utf-8', 'cache-control':'no-store'});
          res.end(html);
        }).catch(error => {
          res.writeHead(500);
          res.end('vite_html_transform_failed: ' + String(error));
        });
        return;
      }
      if (req.method === 'POST' && req.url === '/__atlas_teleprompter_ui_report') {
        let data = '';
        req.on('data', part => { data += String(part); if (data.length > 16000) req.destroy(); });
        req.on('end', () => {
          try {
            resolveReport(JSON.parse(data));
            res.writeHead(200, {'content-type':'text/plain', 'cache-control':'no-store'});
            res.end('ok');
          } catch {
            res.writeHead(400);
            res.end('invalid');
          }
        });
        return;
      }
      next();
    });
  }
};
const server = await createServer({
  configFile: false, root: devRoot, plugins: [react(), stub, middleware],
  server: {host:'127.0.0.1',port:0,strictPort:false},
  logLevel:'error'
});
let chrome, timer, temp;
let browserDiagnostics = '';
try {
  await server.listen();
  const addr = server.httpServer?.address();
  if (!addr || typeof addr === 'string') throw Error('vite_local_server_missing');
  const url = 'http://127.0.0.1:' + addr.port + '/__atlas_teleprompter_ui';
  temp = mkdtempSync(join(tmpdir(), 'atlas-teleprompter-ui-'));
  const bin = process.env.CHROME_BIN || 'google-chrome';
  chrome = spawn(bin, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--disable-extensions', '--disable-sync',
    '--no-first-run', '--no-default-browser-check', '--no-proxy-server',
    '--no-pings', '--disable-component-update',
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
    '--user-data-dir=' + temp, url
  ], {stdio:['ignore','ignore','pipe']});
  chrome.stderr.on('data', b => { browserDiagnostics = (browserDiagnostics + String(b)).slice(-3600); });
  const badExit = new Promise((_,reject) => {
    chrome.once('error', error=>reject(Error('chrome_start_failed:'+error.message)));
    chrome.once('exit', (code,signal)=>reject(Error('chrome_exited_before_ui_result:'+code+':'+signal)));
  });
  const timeout = new Promise((_,reject) => { timer = setTimeout(()=>reject(Error('teleprompter_ui_probe_timeout')), 60000); });
  const result = await Promise.race([resultPromise,badExit,timeout]);
  console.log('ATLAS_REAL_UI_MEDIA_EVIDENCE=' + JSON.stringify(result));
  if (!result.ok || result.mode !== 'actual_teleprompter_ui_synthetic_browser' ||
      result.realDevice !== false || result.cloudBackend !== 'isolated_stub' ||
      result.uploadCalls !== 0 || result.autoCloud !== false ||
      result.syntheticVoiceAdvanced < 3 || result.video.bytes < 1024 ||
      result.video.width < 16 || result.video.height < 16) {
    throw Error('teleprompter_component_smoke_failed');
  }
  console.log('PASS: actual Teleprompter React UI browser capture, synthetic voice cursor, private local playback and bilingual script');
} catch (error) {
  process.exitCode = 1;
  console.error('FAIL:',error);
  console.error('Chromium:', browserDiagnostics.slice(-2000));
} finally {
  clearTimeout(timer);
  chrome?.kill('SIGTERM');
  await server.close();
  if (temp) rmSync(temp, {recursive:true,force:true});
}

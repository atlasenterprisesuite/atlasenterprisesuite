#!/usr/bin/env node
/** ATLAS Phone Bridge: loopback-only Android desktop bridge, no cloud control. */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  MAX_TRANSFER_BYTES, checkedSerial, checkedFileName, listAndroidDevices,
  mirrorArguments, requireAuthorizedDevice, runBinary, sendToAndroid
} from './lib/phone-bridge.mjs';

const HOST = '127.0.0.1';
const token = randomBytes(32).toString('hex');
let mirrorProcess = null;
let lastMirrorError = null;
let transferInProgress = false;

// Interface uses one-time in-process token. No user data reaches ATLAS Cloud.
const HTML = String.raw`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ATLAS Phone Bridge</title><style nonce="__NONCE__">
:root{font:16px system-ui,-apple-system,Segoe UI,sans-serif;color:#edf5ff;background:#081322;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at top right,#123658 0%,transparent 49%),#081322}
main{max-width:1060px;margin:0 auto;padding:36px 18px}.eyebrow{color:#66dae3;text-transform:uppercase;font-size:12px;letter-spacing:2px;font-weight:700}
h1{font-size:clamp(29px,4vw,43px);letter-spacing:-1.5px;margin:10px 0}.sub{color:#adc2d5;line-height:1.65}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:30px}
.card{border:1px solid #325371;background:#112236dd;border-radius:18px;padding:23px;min-width:0}
h2{font-size:20px;margin:0 0 16px}label{display:block;color:#c1d2e2;margin:12px 0 7px}
button,input,select{font:inherit;border-radius:10px;padding:12px;max-width:100%}button{background:#57d5e4;border:0;color:#061523;font-weight:700;cursor:pointer;margin:7px 7px 0 0}
button.secondary{background:#314a65;color:white}button:disabled{opacity:.4;cursor:not-allowed}
select,input{background:#091725;color:white;border:1px solid #4b6d8a;width:100%}
p{color:#b3c7da;line-height:1.6}.wide{grid-column:1/-1}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.steps div{border:1px solid #365877;border-radius:10px;padding:13px}.steps strong{display:block;color:white}
#log{background:#071523;padding:13px;border-radius:10px;overflow-wrap:anywhere;min-height:50px;color:#75ded8}
@media(max-width:700px){.cards{grid-template-columns:1fr}.steps{grid-template-columns:1fr}}:focus-visible{outline:3px solid #9cfffb;outline-offset:3px}
</style></head><body><main>
<div class="eyebrow">ATLAS Enterprise Suite / Device OS</div><h1>ATLAS Phone Bridge</h1>
<p class="sub">Un puente real entre Android y tu laptop: controla con teclado y mouse, transfiere archivos y trabaja localmente, sin servicios de nube.</p>
<div class="cards">
<section class="card"><h2>01 · Conectar dispositivo</h2><label for="devices">Android autorizado</label><select id="devices"></select><p id="deviceState">Buscando teléfonos…</p><button id="refresh" class="secondary">Actualizar</button></section>
<section class="card"><h2>02 · Usar el teléfono</h2><label for="preset">Rendimiento</label><select id="preset"><option value="fast">Rápido · 1280p / hasta 60 fps</option><option value="balanced">Equilibrado · 1600p / hasta 60 fps</option><option value="quality">Calidad · 1920p / hasta 60 fps</option></select><p>scrcpy abrirá una ventana nativa controlable por teclado y mouse.</p><button id="mirror">Abrir pantalla</button><button class="secondary" id="stop">Detener</button></section>
<section class="card"><h2>03 · Enviar archivos</h2><label for="file">Archivo (hasta 32 MiB)</label><input id="file" type="file"><p>Directamente a Descargas/ATLASBridge sin subir el contenido a Internet.</p><button id="send">Enviar al teléfono</button></section>
<section class="card"><h2>04 · Estado real</h2><p id="dependencies">Comprobando ADB y scrcpy…</p><div id="log" role="status" aria-live="polite">Sin operaciones.</div></section>
<section class="card wide"><h2>Preparación</h2><div class="steps"><div><strong>1 · Android</strong>Activa Depuración USB en un teléfono que controles.</div><div><strong>2 · Cable</strong>Conecta por USB y acepta la huella RSA en el propio teléfono.</div><div><strong>3 · Control</strong>Actualiza dispositivos y abre su pantalla. También sirve Wi-Fi con ADB previamente emparejado.</div></div><p>Este servidor responde solo a esta computadora. No ejecuta comandos arbitrarios de ADB ni habilita acceso remoto desatendido.</p></section>
</div></main><script nonce="__NONCE__">
const key='__TOKEN__', $=id=>document.getElementById(id);
function show(s){$('log').textContent=s}
async function request(path,options={}){const response=await fetch(path,{...options,cache:'no-store',headers:{'x-atlas-phone-token':key,...options.headers}});const body=await response.json().catch(()=>({error:'invalid_response'}));if(!response.ok)throw Error(body.error||'operation_failed');return body}
async function refresh(){try{const s=await request('/api/state');$('devices').replaceChildren();for(const d of s.devices){const option=document.createElement('option');option.value=d.serial;option.textContent=d.serial+' — '+d.state;option.disabled=d.state!=='device';$('devices').appendChild(option)}const ok=s.devices.find(d=>d.state==='device');if(ok)$('devices').value=ok.serial;$('mirror').disabled=!ok||!s.scrcpy;$('send').disabled=!ok;$('stop').disabled=!s.mirrorProcessActive;$('dependencies').textContent='ADB: '+(s.adb?'disponible':'ausente')+' · scrcpy: '+(s.scrcpy?'disponible':'ausente')+' · duplicación: '+(s.mirrorProcessActive?'proceso abierto':'inactiva');$('deviceState').textContent=ok?'Teléfono autorizado detectado.':'Sin teléfono autorizado. Revisa cable y permisos.';if(s.lastMirrorError)show(s.lastMirrorError)}catch(e){show(e.message);$('mirror').disabled=true;$('send').disabled=true}}
async function action(path,payload){try{show('Procesando localmente…');const r=await request(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});show(r.message||'Solicitud recibida');await refresh()}catch(e){show(e.message)}}
$('refresh').onclick=refresh;
$('mirror').onclick=()=>action('/api/mirror',{serial:$('devices').value,preset:$('preset').value});
$('stop').onclick=()=>action('/api/stop',{});
$('send').onclick=async()=>{const f=$('file').files[0];if(!f)return show('Selecciona un archivo.');if(f.size>33554432)return show('Tamaño máximo: 32 MiB');try{show('Transfiriendo '+f.name+'…');const r=await request('/api/send',{method:'POST',headers:{'content-type':'application/octet-stream','x-device-serial':$('devices').value,'x-file-name':encodeURIComponent(f.name)},body:f});show('Archivo enviado a '+r.destination);$('file').value='';await refresh()}catch(e){show(e.message)}};
refresh();
</script></body></html>`;

function json(res, code, object) {
  res.writeHead(code, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
  res.end(JSON.stringify(object));
}
async function readLimited(req, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export function createPhoneBridgeServer(port = 8765) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('invalid_loopback_port');
  const origin = 'http://' + HOST + ':' + port;
  return createServer(async (req, res) => {
    res.setHeader('x-content-type-options','nosniff');
    res.setHeader('referrer-policy','no-referrer');
    res.setHeader('x-frame-options','DENY');
    res.setHeader('cache-control','no-store');
    if (req.headers.host !== HOST + ':' + port) return json(res,403,{error:'host_denied'});
    const path = new URL(req.url || '/',origin).pathname;
    if (path === '/' && req.method === 'GET') {
      const nonce = randomBytes(16).toString('base64');
      res.setHeader('content-security-policy',"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
      res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
      return res.end(HTML.replaceAll('__NONCE__',nonce).replace('__TOKEN__',token));
    }
    if (req.headers['x-atlas-phone-token'] !== token) return json(res,403,{error:'session_denied'});
    if (req.method === 'POST' && req.headers.origin !== origin) return json(res,403,{error:'origin_denied'});
    try {
      if (path === '/api/state' && req.method === 'GET') {
        let devices=[],adb=false,scrcpy=false;
        try { devices=await listAndroidDevices();adb=true; } catch {}
        try { await runBinary('scrcpy',['--version']);scrcpy=true; } catch {}
        return json(res,200,{devices,adb,scrcpy,mirrorProcessActive:!!mirrorProcess && mirrorProcess.exitCode===null,lastMirrorError});
      }
      if (path === '/api/mirror' && req.method === 'POST') {
        const {serial,preset}=JSON.parse((await readLimited(req,2048)).toString('utf8'));
        await requireAuthorizedDevice(serial);
        const args=mirrorArguments(serial,preset);
        if(mirrorProcess && mirrorProcess.exitCode===null)throw Error('mirror_already_active');
        await runBinary('scrcpy',['--version']);
        const child=spawn('scrcpy',args,{stdio:'ignore',shell:false,windowsHide:false});
        await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',()=>reject(Error('scrcpy_launch_failed')))});
        mirrorProcess=child;lastMirrorError=null;
        child.once('exit',(code)=>{if(code!==0 && code!==null)lastMirrorError='scrcpy_closed_with_error';if(mirrorProcess===child)mirrorProcess=null});
        return json(res,202,{message:'Se abrió el proceso de duplicación. Comprueba la ventana nativa.'});
      }
      if (path === '/api/stop' && req.method === 'POST') {
        await readLimited(req,2048);
        if(!mirrorProcess || mirrorProcess.exitCode!==null)throw Error('no_mirror_session');
        mirrorProcess.kill();
        return json(res,200,{message:'Se solicitó detener la duplicación.'});
      }
      if (path === '/api/send' && req.method === 'POST') {
        if(transferInProgress)throw Error('transfer_in_progress');
        const serial=checkedSerial(String(req.headers['x-device-serial']||''));
        const name=checkedFileName(decodeURIComponent(String(req.headers['x-file-name']||'')));
        if(req.headers['content-length'] && Number(req.headers['content-length'])>MAX_TRANSFER_BYTES)throw Error('request_too_large');
        await requireAuthorizedDevice(serial);
        transferInProgress=true;
        let dir;
        try {
          const contents=await readLimited(req,MAX_TRANSFER_BYTES);
          if(!contents.length)throw Error('empty_file');
          dir=await mkdtemp(join(tmpdir(),'atlas-phone-'));
          const source=join(dir,'upload');
          await writeFile(source,contents,{mode:0o600,flag:'wx'});
          const destination=await sendToAndroid({serial,localPath:source,fileName:name});
          return json(res,200,{destination});
        } finally {
          transferInProgress=false;
          if(dir)await rm(dir,{recursive:true,force:true});
        }
      }
      return json(res,404,{error:'not_found'});
    } catch(error) {
      const msg=String(error?.message||'operation_failed');
      const allowed=new Set(['invalid_device_serial','invalid_file_name','invalid_mirror_preset','phone_not_authorized_or_disconnected','adb_unavailable_or_failed','scrcpy_unavailable_or_failed','scrcpy_launch_failed','no_mirror_session','mirror_already_active','transfer_in_progress','request_too_large','empty_file']);
      return json(res,400,{error:allowed.has(msg)?msg:'operation_failed'});
    }
  });
}
async function main(){
  if(process.argv.includes('--help')){process.stdout.write('ATLAS Phone Bridge\\nnode tools/local-agent/atlas-phone-bridge.mjs [port]\\nNode.js 22+, adb, scrcpy, and an authorized Android device required.\\n');return}
  const port=Number(process.argv[2]||8765);
  const server=createPhoneBridgeServer(port);
  await new Promise((resolve,reject)=>server.listen(port,HOST,resolve).once('error',reject));
  process.stdout.write('ATLAS Phone Bridge: http://127.0.0.1:'+port+'\\nCtrl+C to stop. Local-only.\\n');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(()=>{process.stderr.write('ATLAS Phone Bridge cannot start: invalid or occupied port.\\n');process.exitCode=1});
}

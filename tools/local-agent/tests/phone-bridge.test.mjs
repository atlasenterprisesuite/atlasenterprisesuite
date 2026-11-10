import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import {
  checkedFileName, checkedSerial, mirrorArguments, parseAdbDevices,
  remoteDownloadPath, requireAuthorizedDevice, sendToAndroid, MAX_TRANSFER_BYTES
} from '../lib/phone-bridge.mjs';
import { createPhoneBridgeServer } from '../atlas-phone-bridge.mjs';

test('reads real adb status and does not infer authorization', () => {
  const observed = parseAdbDevices('List of devices attached\nA1 device product:demo\nB2 offline\nC3 unauthorized\n');
  assert.deepEqual(observed,[{serial:'A1',state:'device'},{serial:'B2',state:'offline'},{serial:'C3',state:'unauthorized'}]);
  assert.deepEqual(parseAdbDevices('List of devices attached\n'),[]);
});
test('rejects command injection and file traversal', () => {
  for(const value of ['', 'a;reboot', 'a b', '../a', 'a\nb'])assert.throws(()=>checkedSerial(value));
  for(const value of ['', '.', '..', '../private', 'folder/secret', 'c:\\secret', 'x\nfile'])assert.throws(()=>checkedFileName(value));
  assert.equal(remoteDownloadPath('Foto.jpg'),'/sdcard/Download/ATLASBridge/Foto.jpg');
  assert.equal(MAX_TRANSFER_BYTES,32*1024*1024);
});
test('uses fixed mirror arguments for speed modes', () => {
  assert.deepEqual(mirrorArguments('A1','fast'),['--serial','A1','--max-size=1280','--max-fps=60','--video-bit-rate=8M','--no-audio','--window-title=ATLAS Phone Bridge']);
  assert.throws(()=>mirrorArguments('A1','unsafe'));
});
test('unauthorized devices cannot receive file transfer', async () => {
  const commands=[];
  const execImpl=async(binary,args)=>{commands.push([binary,...args]);return {stdout:'List of devices attached\nA1 unauthorized\n'}};
  await assert.rejects(requireAuthorizedDevice('A1',{execImpl}),/phone_not_authorized_or_disconnected/);
  await assert.rejects(sendToAndroid({serial:'A1',fileName:'file.pdf',localPath:'/tmp/file',options:{execImpl}}),/phone_not_authorized_or_disconnected/);
  assert.equal(commands.filter(c=>c.includes('push')).length,0);
});
test('authorized transfer runs allowlisted fixed adb arguments only',async()=>{
  const commands=[];
  const execImpl=async(binary,args)=>{commands.push([binary,...args]);return {stdout:args[0]==='devices'?'List of devices attached\nA1 device\n':''}};
  await sendToAndroid({serial:'A1',fileName:'file.pdf',localPath:'/tmp/source',options:{execImpl}});
  assert.deepEqual(commands,[
    ['adb','devices','-l'],
    ['adb','-s','A1','shell','mkdir','-p','/sdcard/Download/ATLASBridge'],
    ['adb','-s','A1','push','/tmp/source','/sdcard/Download/ATLASBridge/file.pdf']
  ]);
});
test('loopback interface blocks nonlocal host, missing tokens and cross-origin commands',async t=>{
  const port=18765,url='http://127.0.0.1:'+port,server=createPhoneBridgeServer(port);
  await new Promise((resolve,reject)=>server.listen(port,'127.0.0.1',resolve).once('error',reject));
  t.after(()=>server.close());
  const page=await fetch(url);
  assert.equal(page.status,200);
  const markup=await page.text();
  const key=/const key='([0-9a-f]{64})'/.exec(markup)?.[1];
  assert.ok(key);
  const missing=await fetch(url+'/api/state');assert.equal(missing.status,403);
  const wrongHost=await new Promise((resolve,reject)=>{
    const req=httpRequest({hostname:'127.0.0.1',port,path:'/api/state',headers:{host:'attacker.example','x-atlas-phone-token':key}},res=>{
      let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve(res.statusCode));
    });req.on('error',reject);req.end();
  });
  assert.equal(wrongHost,403);
  const cross=await fetch(url+'/api/stop',{method:'POST',headers:{origin:'https://attacker.example','x-atlas-phone-token':key},body:'{}'});
  assert.equal(cross.status,403);
  const injection=await fetch(url+'/api/mirror',{method:'POST',headers:{origin:url,'x-atlas-phone-token':key,'content-type':'application/json'},body:JSON.stringify({serial:'bad;command',preset:'fast'})});
  assert.equal(injection.status,400);
});

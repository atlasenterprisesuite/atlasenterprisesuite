'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const state = {source:'', media:null, mediaKind:'', mediaName:'', mediaSize:0, duration:null, width:null, height:null, sha256:null, digestState:'no-file', frames:[], claims:[], moments:[], fileUrl:null, meter:null};
  const MAX_FRAMES=10, MAX_IMPORT=2_000_000;
  const now=()=>new Date().toISOString();
  const player=()=>state.mediaKind==='audio'?$('audio'):$('video');
  const formatTime=s=>Number.isFinite(s)?`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`:'—';
  const bytes=n=>n>=1048576?`${(n/1048576).toFixed(1)} MB`:`${(n/1024).toFixed(1)} KB`;
  const setStatus=(text,kind='')=>{$('sourceStatus').textContent=text;$('sourceStatus').className=`status ${kind}`.trim()};
  function canonicalUrl(text){
    let url;try{url=new URL(text.trim())}catch{return null}
    if(url.protocol!=='https:'&&url.protocol!=='http:')return null;
    if(url.username||url.password)return null;
    url.hash='';
    for(const key of [...url.searchParams.keys()])if(/^(utm_|fbclid|gclid|igsh|gwpx)/i.test(key))url.searchParams.delete(key);
    return url.href;
  }
  function registerUrl(){
    const value=$('sourceUrl').value.trim();
    if(!value){state.source='';$('openOriginal').hidden=true;setStatus('El enlace se ha quitado. Puedes continuar analizando un archivo local.');return}
    const clean=canonicalUrl(value);if(!clean){setStatus('URL inválida. Se requiere un enlace HTTP(S) sin credenciales.','error');return}
    state.source=clean;$('sourceUrl').value=clean;$('openOriginal').href=clean;$('openOriginal').hidden=false;
    const host=new URL(clean).hostname.toLowerCase();
    setStatus(/(^|\.)instagram\.com$/.test(host)
      ?'Instagram registrado como referencia. No se han recuperado el video, la descripción ni comentarios. Adjunta el video autorizado para analizar su contenido.':'Enlace registrado como referencia; su contenido NO se ha descargado ni verificado.', 'warn');
  }
  function revokeMedia(){
    if(state.fileUrl){URL.revokeObjectURL(state.fileUrl);state.fileUrl=null}
    for(const id of ['video','audio']){const old=$(id);old.pause();old.removeAttribute('src');old.load();old.hidden=true;if(state.meter===null&&old.dataset.audioConnected==='yes'){const fresh=old.cloneNode(false);fresh.removeAttribute('data-audio-connected');old.replaceWith(fresh)}}
  }
  async function handleMedia(file){
    state.meter?.stop();state.meter=null;$('enableMeter').textContent='Analizar energía al reproducir';revokeMedia();state.media=null;state.mediaKind='';state.sha256=null;state.digestState='no-file';state.frames=[];renderFrames();
    if(!file){$('emptyPlayer').hidden=false;return}
    const ext=file.name.toLowerCase().split('.').pop();
    const kind=file.type.startsWith('video/')||['mp4','mov','webm','m4v'].includes(ext)?'video':
      file.type.startsWith('audio/')||['mp3','m4a','wav','aac'].includes(ext)?'audio':null;
    if(!kind){setStatus('Formato no compatible para este reproductor.','error');return}
    state.media=file;state.mediaKind=kind;state.mediaName=file.name;state.mediaSize=file.size;state.duration=null;state.width=null;state.height=null;
    state.fileUrl=URL.createObjectURL(file);$('emptyPlayer').hidden=true;
    const media=player();media.src=state.fileUrl;media.hidden=false;
    $('capture').disabled=kind!=='video';$('enableMeter').disabled=false;
    $('duration').textContent='…';$('dimensions').textContent='…';$('fileSize').textContent=bytes(file.size);
    $('integrity').textContent='SHA-256: calculando cuando el archivo lo permite…';
    setStatus('Archivo local seleccionado: '+file.name+'. No se ha subido a ningún servidor.');
    media.onloadedmetadata=()=>{state.duration=Number.isFinite(media.duration)?media.duration:null;state.width=kind==='video'?media.videoWidth:null;state.height=kind==='video'?media.videoHeight:null;
      $('duration').textContent=formatTime(state.duration);$('dimensions').textContent=kind==='video'?`${state.width} × ${state.height}`:'Audio';
    };
    media.onerror=()=>setStatus('El navegador no pudo decodificar este formato. Prueba un MP4/H.264 o audio compatible.','error');
    if(!globalThis.crypto?.subtle){state.digestState='unavailable';$('integrity').textContent='SHA-256: API criptográfica no disponible en este contexto.';return}
    if(file.size>64*1024*1024){state.digestState='size-limit';$('integrity').textContent='SHA-256: no calculado; archivo mayor a 64 MB (límite preventivo de memoria).';return}
    state.digestState='pending';
    try{
      const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
      if(state.media!==file)return;
      state.sha256=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
      state.digestState='verified';$('integrity').textContent='SHA-256 del archivo completo: '+state.sha256;
    }catch{if(state.media!==file)return;state.digestState='error';$('integrity').textContent='SHA-256: falló el cálculo; no se afirma integridad.'}
  }
  function capture(){
    const video=$('video');if(!state.media||state.mediaKind!=='video'||!video.videoWidth||video.readyState<2){setStatus('Espera a que el video cargue un fotograma visible.','warn');return}
    if(state.frames.length>=MAX_FRAMES){setStatus('Límite de 10 capturas. Borra una para añadir otra.','warn');return}
    const canvas=document.createElement('canvas');const scale=Math.min(1,480/video.videoWidth);
    canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    try{canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);state.frames.push({id:crypto.randomUUID?.()||String(Date.now()),at:Number(video.currentTime.toFixed(2)),image:canvas.toDataURL('image/jpeg',.64),createdAt:now()});renderFrames()}
    catch{setStatus('No se pudo capturar el fotograma del archivo local.','error')}
  }
  function node(tag,content,className=''){const el=document.createElement(tag);if(content!==undefined)el.textContent=String(content);if(className)el.className=className;return el}
  function addDelete(container,callback){const b=node('button','Quitar','small');b.type='button';b.setAttribute('aria-label','Eliminar esta evidencia');b.addEventListener('click',callback);container.append(b)}
  function renderFrames(){
    const holder=$('frames');holder.replaceChildren();
    for(const frame of state.frames){const item=node('div',undefined,'frame');const img=document.createElement('img');img.src=frame.image;img.alt='Fotograma capturado a los '+formatTime(frame.at);item.append(img);const foot=node('div');foot.append(node('span',formatTime(frame.at)));addDelete(foot,()=>{state.frames=state.frames.filter(v=>v.id!==frame.id);renderFrames()});item.append(foot);holder.append(item)}
    $('frameCount').textContent=state.frames.length+' capturas';updateVerdict()
  }
  const input = id => $(id).value.trim();
  function addClaim(){
    const text=input('claimText');if(!text){$('claimText').focus();return}
    const status=input('claimStatus'), evidence=input('claimEvidence');
    if(status!=='unverified'&&!evidence){setStatus('Para respaldar o contradecir una afirmación debes describir su evidencia.','warn');$('claimEvidence').focus();return}
    state.claims.push({id:crypto.randomUUID?.()||String(Date.now()),text,origin:input('claimOrigin'),status,evidence,createdAt:now()});
    $('claimText').value='';$('claimEvidence').value='';$('claimStatus').value='unverified';renderClaims();
  }
  function renderClaims(){
    const holder=$('claims');holder.replaceChildren();
    for(const claim of state.claims){const card=node('div',undefined,'note');const row=node('div',undefined,'row');
      const names={unverified:'No verificado',supported:'Respaldado · evaluación propia',contradicted:'Contradicho · evaluación propia'};
      row.append(node('span',names[claim.status]||names.unverified,'capsule '+claim.status));addDelete(row,()=>{state.claims=state.claims.filter(v=>v.id!==claim.id);renderClaims()});card.append(row,node('p',claim.text),node('small',claim.origin+' · '+(claim.evidence||'Sin evidencia adicional')));holder.append(card)}
    updateVerdict()
  }
  function addMoment(){
    const text=input('momentText');if(!text){$('momentText').focus();return}
    const time=Number.isFinite(player().currentTime)?player().currentTime:0;
    state.moments.push({id:crypto.randomUUID?.()||String(Date.now()),at:Number(time.toFixed(2)),text,createdAt:now()});
    $('momentText').value='';renderMoments();
  }
  function renderMoments(){
    const holder=$('moments');holder.replaceChildren();
    for(const moment of state.moments){const card=node('div',undefined,'note');const row=node('div',undefined,'row');row.append(node('small',formatTime(moment.at)));addDelete(row,()=>{state.moments=state.moments.filter(v=>v.id!==moment.id);renderMoments()});card.append(row,node('p',moment.text));holder.append(card)}
    updateVerdict()
  }
  function extractTokens(){
    const text=input('caption')+'\n'+input('transcript');
    const values=[...new Set(text.match(/#[\p{L}\p{N}_]+|@[\p{L}\p{N}_.]+|https?:\/\/[^\s)]+/gu)||[])].slice(0,60);
    $('tokens').replaceChildren(...values.map(token=>node('span',token,'pill')));
    if(!values.length)$('tokens').append(node('span','No se detectaron tokens con este método local.','hint'));
  }
  function updateVerdict(){
    const unverified=state.claims.filter(c=>c.status==='unverified').length;
    $('claimTotal').textContent=state.claims.length;$('unverifiedTotal').textContent=unverified;$('momentTotal').textContent=state.moments.length;
    const hasMedia=Boolean(state.media),hasText=Boolean(input('transcript')||input('caption'));
    const verdict=$('verdict');
    if(!hasMedia&&!hasText){verdict.textContent='P0 · NO VERIFICADO — todavía no hay contenido inspeccionado.';verdict.className='status warn'}
    else if(unverified){verdict.textContent=`P0 · REVISIÓN PENDIENTE — ${unverified} afirmación(es) sin verificar. La evidencia local no valida hechos externos.`;verdict.className='status warn'}
    else{verdict.textContent='EVIDENCIA LOCAL REGISTRADA — no constituye verificación externa de hechos, personas o autoría.';verdict.className='status'}
  }
  function reportData(){
    return {schema:'atlas-reel-evidence-v1',generatedAt:now(),method:'local-browser-no-network',source:{url:state.source||null,metadataOnly:Boolean(state.source)},media:{filename:state.media?state.mediaName:null,sizeBytes:state.media?state.mediaSize:null,kind:state.mediaKind||null,durationSeconds:state.duration,videoWidth:state.width,videoHeight:state.height,sha256:state.sha256,digestStatus:state.digestState},text:{caption:input('caption'),transcript:input('transcript'),soundNotes:input('soundNotes')},frames:state.frames,claims:state.claims,moments:state.moments,limitations:['An URL does not prove that content was accessed.','No automatic transcription, OCR, factual verification, or identity recognition.','Claim evaluations are user supplied, not independently verified.','Local media is not included in this JSON report.']};
  }
  function reportMarkdown(){
    const d=reportData();const m=d.media;
    const safe=s=>String(s??'—').replace(/\r/g,'');
    const lines=['# ATLAS Reel Evidence Lab — Informe 777','',`Fecha UTC: ${d.generatedAt}`,`Método: ${d.method}`,'', '## Fuente',`URL registrada: ${safe(d.source.url)}`,'El enlace es una referencia y NO acredita extracción automática.','', '## Archivo local',`Nombre: ${safe(m.filename)}`,`Tamaño: ${m.sizeBytes??'—'} bytes`,`Duración: ${formatTime(m.durationSeconds)}`,`Resolución: ${m.videoWidth||'—'} x ${m.videoHeight||'—'}`,`SHA-256: ${safe(m.sha256)}`,`Estado de hash: ${m.digestStatus}`,'','## Texto aportado','', '### Descripción',safe(d.text.caption),'','### Transcripción',safe(d.text.transcript),'','### Sonido',safe(d.text.soundNotes),'','## Fotogramas',...d.frames.map(f=>`- ${formatTime(f.at)} — imagen incluida únicamente en exportación JSON.`),'','## Afirmaciones',...d.claims.map(c=>`- [${c.status}] ${safe(c.text)} | Origen: ${c.origin} | Evidencia aportada: ${safe(c.evidence)}`),'','## Observaciones temporales',...d.moments.map(t=>`- ${formatTime(t.at)} — ${safe(t.text)}`),'','## Límites',...d.limitations.map(x=>'- '+x)];
    return lines.join('\n')
  }
  function download(name,contents,type){
    const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)
  }
  function exportJson(){download('atlas-reel-evidence-777.json',JSON.stringify(reportData(),null,2),'application/json')}
  function exportMd(){download('atlas-reel-informe-777.md',reportMarkdown(),'text/markdown;charset=utf-8')}
  async function importJson(file){
    if(!file)return;if(file.size>MAX_IMPORT){setStatus('El informe excede el límite de importación (2 MB).','error');return}
    let d;try{d=JSON.parse(await file.text())}catch{setStatus('JSON inválido.','error');return}
    if(d?.schema!=='atlas-reel-evidence-v1'||!Array.isArray(d.claims)||!Array.isArray(d.frames)||!Array.isArray(d.moments)){setStatus('Esquema de evidencia desconocido.','error');return}
    if(d.claims.length>300||d.frames.length>MAX_FRAMES||d.moments.length>300){setStatus('La cantidad de registros excede los límites.','error');return}
    // The imported report is untrusted; only allow known text fields and bounded payloads.
    const short=(x,max=15000)=>typeof x==='string'?x.slice(0,max):'';
    state.claims=d.claims.map((c,i)=>({id:String(i),text:short(c.text,1500),origin:short(c.origin,40),status:['unverified','supported','contradicted'].includes(c.status)?c.status:'unverified',evidence:short(c.evidence,3000),createdAt:short(c.createdAt,50)}));
    state.moments=d.moments.map((m,i)=>({id:String(i),at:Number.isFinite(m.at)?Math.max(0,m.at):0,text:short(m.text,3000),createdAt:short(m.createdAt,50)}));
    state.frames=d.frames.filter(f=>typeof f.image==='string'&&/^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(f.image)&&f.image.length<130000).map((f,i)=>({id:String(i),at:Number.isFinite(f.at)?Math.max(0,f.at):0,image:f.image,createdAt:short(f.createdAt,50)}));
    for(const id of ['caption','transcript','soundNotes'])$(id).value=short(d.text?.[id],35000);
    state.source=canonicalUrl(short(d.source?.url,2200))||'';$('sourceUrl').value=state.source;
    $('openOriginal').hidden=!state.source;if(state.source)$('openOriginal').href=state.source;
    // Do not trust an imported hash as verification of a locally loaded file.
    state.meter?.stop();state.meter=null;revokeMedia();state.media=null;state.mediaKind='';state.mediaName='';state.sha256=null;state.digestState='import-unverified';
    $('emptyPlayer').hidden=false;$('mediaFile').value='';$('enableMeter').textContent='Analizar energía al reproducir';$('duration').textContent='—';$('dimensions').textContent='—';$('fileSize').textContent='—';$('capture').disabled=true;$('enableMeter').disabled=true;
    $('integrity').textContent='SHA-256: valor importado no validado contra un archivo local.';
    renderClaims();renderFrames();renderMoments();extractTokens();
    setStatus('Caso JSON importado. El archivo multimedia NO está adjunto. Vuelve a seleccionarlo para validar la huella digital.', 'warn')
  }
  function enableMeter(){
    const el=player();if(!state.media){return}
    if(state.meter){$('enableMeter').textContent='Medidor activado';return}
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx){setStatus('Este navegador no dispone de Web Audio para medir energía.','warn');return}
    try{
      const ctx=new AudioCtx();const source=ctx.createMediaElementSource(el),analyser=ctx.createAnalyser();el.dataset.audioConnected='yes';
      analyser.fftSize=1024;source.connect(analyser);analyser.connect(ctx.destination);
      const arr=new Uint8Array(analyser.frequencyBinCount),canvas=$('meter'),g=canvas.getContext('2d');
      let active=true;function draw(){if(!active)return;requestAnimationFrame(draw);analyser.getByteFrequencyData(arr);g.clearRect(0,0,canvas.width,canvas.height);const count=48,w=canvas.width/count;
        for(let i=0;i<count;i++){const value=arr[Math.min(arr.length-1,Math.floor(i*arr.length/count))]/255;g.fillStyle='#4fa8f0';g.fillRect(i*w+2,canvas.height-(value*canvas.height),w-4,value*canvas.height)}}
      draw();state.meter={ctx,stop:()=>{active=false;ctx.close().catch(()=>{})}};$('enableMeter').textContent='Medidor activo';ctx.resume().catch(()=>{});setStatus('Medidor de energía activado: muestra bandas de frecuencia durante la reproducción, no un análisis completo de la canción.');
    }catch{setStatus('El navegador bloqueó Web Audio para este formato; el video sigue disponible.','warn')}
  }
  function clearAll(){
    if(!confirm('¿Borrar todos los textos, observaciones y capturas de esta sesión? Esta acción no puede deshacerse.'))return;
    state.meter?.stop();state.meter=null;revokeMedia();state.media=null;state.mediaKind='';state.frames=[];state.claims=[];state.moments=[];state.source='';state.sha256=null;state.digestState='no-file';
    for(const id of ['sourceUrl','caption','transcript','soundNotes','claimText','claimEvidence','momentText'])$(id).value='';
    $('mediaFile').value='';$('openOriginal').hidden=true;$('emptyPlayer').hidden=false;$('duration').textContent='—';$('dimensions').textContent='—';$('fileSize').textContent='—';$('integrity').textContent='SHA-256: pendiente de archivo local.';
    $('capture').disabled=true;$('enableMeter').disabled=true;$('enableMeter').textContent='Analizar energía al reproducir';$('tokens').replaceChildren();
    const g=$('meter').getContext('2d');g.clearRect(0,0,700,80);renderFrames();renderClaims();renderMoments();setStatus('Sesión eliminada de memoria. No hay una copia en un servidor.');
  }
  $('registerUrl').addEventListener('click',registerUrl);
  $('mediaFile').addEventListener('change',e=>handleMedia(e.target.files?.[0]));
  $('capture').addEventListener('click',capture);
  $('enableMeter').addEventListener('click',enableMeter);
  $('addClaim').addEventListener('click',addClaim);
  $('addMoment').addEventListener('click',addMoment);
  $('extractTokens').addEventListener('click',extractTokens);
  $('caption').addEventListener('input',updateVerdict);$('transcript').addEventListener('input',updateVerdict);
  $('exportJson').addEventListener('click',exportJson);
  $('exportMd').addEventListener('click',exportMd);
  $('copyReport').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(reportMarkdown());setStatus('Informe copiado al portapapeles.')}catch{setStatus('El portapapeles está bloqueado aquí. Usa «Informe Markdown».','warn')}});
  $('printReport').addEventListener('click',()=>window.print());
  $('importButton').addEventListener('click',()=>$('importJson').click());
  $('importJson').addEventListener('change',e=>importJson(e.target.files?.[0]));
  $('clearAll').addEventListener('click',clearAll);
  window.addEventListener('pagehide',()=>{state.meter?.stop();revokeMedia()});
  updateVerdict();
})();

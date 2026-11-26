import { useEffect, useRef, useState } from 'react';
import { decodeSonicPcm, encodeSonicStereo, mixSonicTracks, SONIC_STUDIO_RATE, type SonicTrack } from '../../../../../../packages/creator/audio/sonic_multitrack';
import { buildLocalWaveform } from '../../../../../../packages/creator/audio/local_analysis';
type Track = SonicTrack & { id:number; title:string; waveform:number[] };
export function SonicMultitrack(){
  const [tracks,setTracks]=useState<Track[]>([]);
  const [busy,setBusy]=useState(false);
  const [url,setUrl]=useState<string|null>(null);
  const [message,setMessage]=useState('Import up to four authorized PCM16 WAV files.');
  const lock=useRef(false), serial=useRef(0), mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
  async function load(files:File[]){
    if(lock.current||!files.length)return;
    lock.current=true;setBusy(true);setUrl(null);
    const added:Track[]=[];let rejected=0;
    try{
      for(const file of files.slice(0,4-tracks.length)){
        if(!mounted.current)return;
        try{
          if(!file.size||file.size>6*1024*1024||!file.name.toLowerCase().endsWith('.wav'))throw Error('Invalid input');
          const track=decodeSonicPcm(await file.arrayBuffer());
          if(!mounted.current)return;
          added.push({...track,id:++serial.current,title:file.name,waveform:buildLocalWaveform(track.left)});
        }catch{rejected++;}
      }
      if(mounted.current){setTracks(old=>[...old,...added]);setMessage(added.length+' imported; '+(rejected+Math.max(0,files.length-(4-tracks.length)))+' skipped. Audio remains local.');}
    }finally{lock.current=false;if(mounted.current)setBusy(false);}
  }
  function edit(id:number,patch:Partial<SonicTrack>){
    setUrl(null);setTracks(old=>old.map(t=>t.id===id?{...t,...patch}:t));setMessage('Mix changed. Render again to preview.');
  }
  function renderMix(){
    setUrl(null);
    try{
      const bytes=encodeSonicStereo(mixSonicTracks(tracks,SONIC_STUDIO_RATE));
      const copy=new Uint8Array(bytes.length);copy.set(bytes);
      setUrl(URL.createObjectURL(new Blob([copy.buffer],{type:'audio/wav'})));
      setMessage('Stereo mix ready. Playback is manual.');
    }catch{setMessage('Mix blocked: invalid track or unsupported browser capability.');}
  }
  return <section className="atlas-dj-panel" aria-label="SONIC multitrack studio">
    <h2>SONIC Multitrack Studio</h2>
    <p>Local PCM16 WAV mixing. Up to four tracks, 30 seconds per project, stereo output at 22.05 kHz. No upload or automatic playback.</p>
    <label className="atlas-dj-upload">Import PCM WAV tracks<input aria-label="Import PCM WAV tracks" type="file" accept=".wav,audio/wav" multiple disabled={busy||tracks.length>=4} onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';void load(files);}}/></label>
    {tracks.map((t,i)=><fieldset key={t.id} disabled={busy}>
      <legend>Track {i+1}</legend><strong>{t.title}</strong>
      <div className="atlas-dj-waveform" role="img" aria-label={'Relative RMS waveform of left channel for track '+(i+1)}>{t.waveform.map((v,j)=><span key={j} aria-hidden="true" style={{height:(100*v)+'%'}}/>)}</div>
      <div className="atlas-dj-controls">
        <label>Volume {Math.round(t.gain*100)}%<input aria-label={'Volume track '+(i+1)} type="range" min="0" max="1" step=".01" value={t.gain} onChange={e=>edit(t.id,{gain:Number(e.target.value)})}/></label>
        <label>Balance<input aria-label={'Balance track '+(i+1)} type="range" min="-1" max="1" step=".05" value={t.pan} onChange={e=>edit(t.id,{pan:Number(e.target.value)})}/></label>
        <label>Offset seconds<input aria-label={'Offset track '+(i+1)} type="range" min="0" max={Math.max(0,Math.floor((30*SONIC_STUDIO_RATE-t.left.length)/(.1*SONIC_STUDIO_RATE))*.1)} step=".1" value={t.offset/SONIC_STUDIO_RATE} onChange={e=>edit(t.id,{offset:Math.round(Number(e.target.value)*SONIC_STUDIO_RATE)})}/></label>
        <label><input aria-label={'Mute track '+(i+1)} type="checkbox" checked={t.mute} onChange={e=>edit(t.id,{mute:e.target.checked})}/>Mute</label>
        <label><input aria-label={'Solo track '+(i+1)} type="checkbox" checked={t.solo} onChange={e=>edit(t.id,{solo:e.target.checked})}/>Solo</label>
        <button type="button" onClick={()=>{setUrl(null);setTracks(old=>old.filter(x=>x.id!==t.id));setMessage('Track removed. Render again.');}}>Remove track {i+1}</button>
      </div>
    </fieldset>)}
    <button type="button" disabled={busy||!tracks.length} onClick={renderMix}>Render stereo mix</button>
    <p role="status">{message}</p>
    {url&&<><audio key={url} controls preload="none" src={url} aria-label="Stereo mix preview"/><p><a href={url} download="atlas-sonic-mix.wav">Download stereo mix WAV</a></p></>}
    <p>Peak attenuation is not professional mastering. Import only audio you have permission to use. Projects are temporary.</p>
  </section>;
}

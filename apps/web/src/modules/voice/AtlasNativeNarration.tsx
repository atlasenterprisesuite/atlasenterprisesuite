import React, { useEffect, useRef, useState } from 'react';
import { atlasVoiceApi } from './voiceApi';
import { StudioPlayer } from './StudioPlayer';

type VoiceLocale = 'es-ES' | 'es-MX' | 'en-US' | 'en-GB';

/** Local generic TTS only. Does not use, modify or imply a personal voice clone. */
export function AtlasNativeNarration({lang = 'es'}:{lang?:'es'|'en'}) {
  const [text,setText] = useState('Bienvenido a ATLAS. Esta es una narración sintética genérica.');
  const [locale,setLocale] = useState<VoiceLocale>('es-MX');
  const [rate,setRate] = useState(175);
  const [state,setState] = useState('checking');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [audioUrl,setAudioUrl] = useState('');
  const currentUrl = useRef('');
  const activeRequest = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  useEffect(()=>{
    mounted.current=true;
    let cancelled=false;
    atlasVoiceApi.atlasNativeGenericStatus()
      .then(status=>{ if(!cancelled)setState(status.state); })
      .catch(()=>{if(!cancelled)setState('runtime_unavailable');});
    return ()=>{
      cancelled=true; mounted.current=false;
      activeRequest.current?.abort();
      if(currentUrl.current)URL.revokeObjectURL(currentUrl.current);
    };
  },[]);
  async function generate(){
    if(busy || state !== 'runtime_ready' || !text.trim() || text.length > 1000)return;
    setBusy(true);setError('');
    if(currentUrl.current)URL.revokeObjectURL(currentUrl.current);
    currentUrl.current='';setAudioUrl('');
    const controller=new AbortController();
    activeRequest.current=controller;
    try{
      const audio=await atlasVoiceApi.synthesizeAtlasNativeGeneric({text:text.trim(),locale,speechRate:rate},controller.signal);
      if(controller.signal.aborted || !mounted.current)return;
      const url=URL.createObjectURL(audio);
      currentUrl.current=url;setAudioUrl(url);
    }catch(reason){
      if(mounted.current && !controller.signal.aborted){
        setError(reason instanceof Error?reason.message:'No se pudo generar el audio local.');
      }
    }finally{
      if(mounted.current)setBusy(false);
    }
  }
  const es=lang==='es';
  return <section className="studio-workspace" aria-labelledby="atlas-native-voice-heading">
    <div className="studio-voice-stage">
      <h2 id="atlas-native-voice-heading">{es?'ATLAS · Voz local':'ATLAS · Local voice'}</h2>
      <p>{es?'Motor autónomo, síntesis genérica':'Self-hosted engine, generic speech'}</p>
      <p role="status">{state==='checking'
        ?(es?'Comprobando servicio local…':'Checking local service…')
        :state==='runtime_ready'
          ?(es?'Servicio local disponible. La generación aún debe verificarse.':'Local service available. Generation is not yet verified.')
          :(es?'Servicio local no disponible: ':'Local service unavailable: ')+state}</p>
      {audioUrl
        ?<StudioPlayer src={audioUrl} title={es?'Narración ATLAS local':'ATLAS local narration'} lang={lang}/>
        :<p>{es?'Sin audio generado todavía.':'No audio generated yet.'}</p>}
    </div>
    <div className="studio-editor">
      <div className="studio-editor-heading">
        <label htmlFor="atlas-native-text">{es?'Guion':'Script'}</label>
        <span>{text.length} / 1000</span>
      </div>
      <textarea id="atlas-native-text" value={text} rows={5} maxLength={1000}
        disabled={busy} onChange={event=>setText(event.target.value)}/>
      <div className="studio-field-row">
        <label>{es?'Idioma de salida':'Output language'}
          <select className="studio-choice" value={locale} disabled={busy}
            onChange={e=>setLocale(e.target.value as VoiceLocale)}>
            <option value="es-MX">Español latinoamericano</option>
            <option value="es-ES">Español (España)</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
          </select>
        </label>
        <label>{es?'Velocidad':'Speech rate'}
          <input type="range" min={100} max={250} step={5} value={rate}
            disabled={busy} aria-label={es?'Velocidad de narración':'Narration speed'}
            onChange={e=>setRate(Number(e.target.value))}/>
          <span>{rate}</span>
        </label>
      </div>
      <button type="button" className="studio-generate"
        disabled={busy || state!=='runtime_ready' || !text.trim()}
        onClick={generate}>{busy
          ?(es?'Generando…':'Generating…')
          :(es?'Generar WAV local':'Generate local WAV')}</button>
      <small className="studio-credit-note">{es
        ?'Voz genérica generada por software local. No es una clonación de tu voz y no utiliza créditos de terceros.'
        :'Generic locally synthesized voice. This is not a personal voice clone or paid external provider.'}</small>
      {error&&<p role="alert" className="studio-error">{error}</p>}
      {audioUrl&&<p role="status" className="studio-success">{es?'Audio WAV local generado. Voz sintética.':'Local WAV generated. Synthetic voice.'}</p>}
    </div>
  </section>;
}

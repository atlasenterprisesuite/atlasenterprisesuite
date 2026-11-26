import { describe, expect, it, vi } from 'vitest';
import { nativeGenericSpeech, nativeGenericStatus, validateNativeGenericInput } from '../../supabase/functions/atlas-voice-provider/native-generic.mjs';

const config = {url:'http://atlas-native.local:8789',token:'private-test-token'};
const request = {mode:'generic',text:'Hola desde ATLAS',locale:'es-ES',speechRate:175};
const wav = () => {
  const a = new Uint8Array(48);
  a.set([82,73,70,70],0);
  a.set([87,65,86,69],8);
  return a;
};
const ok = () => new Response(wav(), {status:200,headers:{
  'content-type':'audio/wav','x-atlas-voice-mode':'generic','content-length':'48'
}});
describe('ATLAS local generic speech provider',()=>{
  it('never treats a generic voice as a personal clone',()=>{
    expect(()=>validateNativeGenericInput({...request,mode:'personal'})).toThrow('personal_voice_not_supported');
    expect(()=>validateNativeGenericInput({...request,privateVoiceRef:'private:voice-1'})).toThrow('invalid_input');
    expect(()=>validateNativeGenericInput({...request,profile_id:'owner'})).toThrow('invalid_input');
  });
  it('applies exact locale and input limits',()=>{
    expect(()=>validateNativeGenericInput({...request,locale:'fr-FR'})).toThrow('locale_not_supported');
    expect(()=>validateNativeGenericInput({...request,speechRate:800})).toThrow('speech_rate_invalid');
    expect(()=>validateNativeGenericInput({...request,text:'x'.repeat(1001)})).toThrow('invalid_input');
  });
  it('fails closed before any network call when unconfigured',async()=>{
    const fetcher=vi.fn();
    await expect(nativeGenericSpeech({url:'',token:''},request,fetcher)).rejects.toThrow('provider_not_configured');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('health status does not claim synthesis was verified',async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({
      state:'ready',dependencies:{espeak:true,ffmpeg:true,ffprobe:true},capabilities:['local-tts']
    }),{status:200,headers:{'content-type':'application/json'}}));
    expect(await nativeGenericStatus(config,fetcher)).toMatchObject({
      state:'runtime_ready',mode:'generic',synthesis_verified:false
    });
    expect(fetcher.mock.calls[0][0]).toBe(config.url+'/health');
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe('Bearer '+config.token);
  });
  it('declares missing runtime or dependencies unavailable',async()=>{
    expect((await nativeGenericStatus({url:'',token:''})).state).toBe('provider_not_configured');
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({
      state:'resource-blocked',dependencies:{espeak:false,ffmpeg:true,ffprobe:true},capabilities:['local-tts']
    }),{status:200}));
    expect((await nativeGenericStatus(config,fetcher)).state).toBe('runtime_unavailable');
  });
  it('sends only validated generic text and returns synthetic disclosed WAV',async()=>{
    const fetcher=vi.fn(async()=>ok());
    const response=await nativeGenericSpeech(config,request,fetcher);
    expect(fetcher.mock.calls[0][0]).toBe(config.url+'/speech');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(request);
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe('Bearer '+config.token);
    expect(response.headers.get('x-atlas-ai-disclosure')).toBe('AI-generated generic voice');
    expect(response.headers.get('x-atlas-voice-mode')).toBe('generic');
    expect((await response.arrayBuffer()).byteLength).toBe(48);
  });
  it('rejects identity-misleading, malformed or oversized upstream audio',async()=>{
    await expect(nativeGenericSpeech(config,request,vi.fn(async()=>new Response(wav(), {
      headers:{'content-type':'audio/wav','x-atlas-voice-mode':'personal'}
    })))).rejects.toThrow('native_invalid_response');
    await expect(nativeGenericSpeech(config,request,vi.fn(async()=>new Response('hello', {
      headers:{'content-type':'audio/wav','x-atlas-voice-mode':'generic'}
    })))).rejects.toThrow('native_invalid_response');
    await expect(nativeGenericSpeech(config,request,vi.fn(async()=>new Response(wav(), {
      headers:{'content-type':'audio/wav','x-atlas-voice-mode':'generic','content-length':'30000000'}
    })))).rejects.toThrow('native_invalid_response');
  });
  it('does not leak upstream failure bodies or tokens',async()=>{
    const fetcher=vi.fn(async()=>new Response('private-test-token', {status:503}));
    await expect(nativeGenericSpeech(config,request,fetcher)).rejects.toThrow('runtime_unavailable');
  });
});

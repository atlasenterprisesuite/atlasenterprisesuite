import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasNativeNarration } from '../../apps/web/src/modules/voice/AtlasNativeNarration';
import { AtlasVoiceApi, atlasVoiceApi } from '../../apps/web/src/modules/voice/voiceApi';

afterEach(()=>{cleanup();vi.restoreAllMocks()});

const context={userId:'owner-user',orgId:'org-test'};
describe('ATLAS Voice Studio generic-native endpoint',()=>{
  it('defaults to local generic narration and never claims personal cloning',async()=>{
    vi.spyOn(atlasVoiceApi,'atlasNativeGenericStatus').mockResolvedValue({
      state:'runtime_ready',configured:true,synthesis_verified:false,
      mode:'generic',locales:['es-MX','es-ES','en-US','en-GB']
    });
    render(<AtlasNativeNarration lang="es"/>);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Generar WAV local'})).toBeEnabled());
    expect(screen.getByText(/No es una clonación de tu voz/)).toBeInTheDocument();
    expect(screen.getByText(/La generación aún debe verificarse/)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('es-MX');
  });
  it('fails closed in the UI when the native service is not ready',async()=>{
    vi.spyOn(atlasVoiceApi,'atlasNativeGenericStatus').mockResolvedValue({
      state:'runtime_unavailable',configured:true,synthesis_verified:false,
      mode:'generic',locales:['es-MX']
    });
    render(<AtlasNativeNarration lang="es"/>);
    await waitFor(()=>expect(screen.getByText(/Servicio local no disponible/)).toBeInTheDocument());
    expect(screen.getByRole('button',{name:'Generar WAV local'})).toBeDisabled();
  });
  it('sends only the generic mode, selected locale and authorized organization',async()=>{
    const calls:Array<{path:string,init?:RequestInit}>=[];
    const transport=vi.fn(async(path:string,init?:RequestInit)=>{
      calls.push({path,init});
      if(path.includes('api=status'))return new Response(JSON.stringify({
        state:'runtime_ready',configured:true,synthesis_verified:false,
        mode:'generic',locales:['es-MX']
      }),{headers:{'content-type':'application/json'}});
      return new Response(new Uint8Array(48),{status:200,headers:{
        'content-type':'audio/wav','x-atlas-voice-mode':'generic'
      }});
    });
    const api=new AtlasVoiceApi({transport,getContext:async()=>context});
    await api.atlasNativeGenericStatus();
    const audio=await api.synthesizeAtlasNativeGeneric({
      text:'Prueba ATLAS',locale:'es-MX',speechRate:180
    });
    expect(audio.size).toBe(48);
    expect(calls.map(x=>x.path)).toEqual([
      '/functions/v1/atlas-voice-provider?api=status&provider=atlas_native_generic',
      '/functions/v1/atlas-voice-provider?api=speech&provider=atlas_native_generic'
    ]);
    expect(new Headers(calls[1].init?.headers).get('x-atlas-org-id')).toBe(context.orgId);
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      mode:'generic',text:'Prueba ATLAS',locale:'es-MX',speechRate:180
    });
    expect(calls[1].init?.method).toBe('POST');
  });
  it('rejects wrong content type and false generic labels at the web API boundary',async()=>{
    const api=new AtlasVoiceApi({
      transport:async()=>new Response('bad', {headers:{'content-type':'application/json'}}),
      getContext:async()=>context
    });
    await expect(api.synthesizeAtlasNativeGeneric({
      text:'Hola',locale:'es-ES',speechRate:175
    })).rejects.toThrow('native_invalid_response');
  });
  it('makes native route permission and audit requirements explicit in edge code',()=>{
    const edge=readFileSync('supabase/functions/atlas-voice-provider/index.ts','utf8');
    expect(edge).toContain("context(req,'voice.personal.use')");
    expect(edge).toContain('await audit(\'voice.atlas_native_generic.requested\')');
    expect(edge).toContain('await audit(\'voice.atlas_native_generic.completed\')');
    expect(edge).toContain('if (provider === \'atlas_native_generic\')');
    expect(edge).toContain('validateNativeGenericInput(raw)');
  });
});

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceStudioPage } from '../../apps/web/src/modules/voice/VoiceStudioPage';
import { StudioPlayer } from '../../apps/web/src/modules/voice/StudioPlayer';
import { atlasVoiceApi } from '../../apps/web/src/modules/voice/voiceApi';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Voice Studio reference implementation', () => {
  it('switches interface language without dropping the real bilingual audio library or assistant', async () => {
    vi.spyOn(atlasVoiceApi, 'elevenLabsStatus').mockResolvedValue({ state: 'access_verified', configured: true, synthesis_verified: false });
    const { container } = render(<MemoryRouter><VoiceStudioPage/></MemoryRouter>);
    expect(screen.getByRole('heading', {name:'Biblioteca de audio'})).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'Biblioteca'})).toHaveAttribute('href','#biblioteca-audio');
    const tracks = Array.from(container.querySelectorAll('.studio-library audio')).map(audio => audio.getAttribute('src'));
    expect(tracks).toEqual(['/assets/voice/bienvenida_es.mp3','/assets/voice/bienvenida_en.mp3','/assets/voice/navegacion_es.mp3','/assets/voice/navegacion_en.mp3','/assets/voice/ayuda_es.mp3','/assets/voice/ayuda_en.mp3']);
    fireEvent.click(screen.getByRole('button',{name:'EN',exact:true}));
    expect(screen.getByRole('heading',{name:'Audio library'})).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'Personal Voice'})).toHaveAttribute('href','/voice/personal-voice');
    expect(screen.getByRole('heading',{name:'Talk to ATLAS'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Generate MP3'})).toBeInTheDocument();
  });
  it('plays the selected asset, pauses another track, seeks, and exposes actual playback failures', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(() => {});
    const { container } = render(<><StudioPlayer src="/welcome.mp3" title="Welcome"/><audio src="/other.mp3"/></>);
    fireEvent.click(screen.getByRole('button',{name:'Reproducir Welcome'}));
    expect(play).toHaveBeenCalledOnce(); expect(pause).toHaveBeenCalledOnce();
    const audio = container.querySelector('audio')!;
    Object.defineProperty(audio,'duration',{configurable:true,value:12});
    fireEvent.loadedMetadata(audio);
    fireEvent.change(screen.getByRole('slider'),{target:{value:'4'}});
    expect(audio.currentTime).toBe(4);
    fireEvent.error(audio);
    expect(screen.getByRole('alert')).toHaveTextContent('Audio no disponible.');
  });
});

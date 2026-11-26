import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SonicMultitrack } from '../../apps/web/src/modules/creator/music/SonicMultitrack';
import { encodeSonicStereo } from '../../packages/creator/audio/sonic_multitrack';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('SONIC multitrack studio',()=>{
  it('imports PCM locally, renders only on request and invalidates stale output',async()=>{
    const create=vi.fn(()=> 'blob:sonic-mix');
    const revoke=vi.fn();
    const OriginalURL=URL;
    vi.stubGlobal('URL',class extends OriginalURL {
      static createObjectURL=create;
      static revokeObjectURL=revoke;
    });
    const bytes=encodeSonicStereo({left:new Float32Array([.1,.2]),right:new Float32Array([.1,.2]),rate:22050});
    const file=new File([new Uint8Array(bytes).buffer],'original.wav',{type:'audio/wav'});
    Object.defineProperty(file,'arrayBuffer',{value:async()=>new Uint8Array(bytes).buffer});
    render(<SonicMultitrack/>);
    expect(screen.getByRole('button',{name:'Render stereo mix'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Import PCM WAV tracks'),{target:{files:[file]}});
    await screen.findByText('original.wav');
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Render stereo mix'}));
    expect(screen.getByRole('link',{name:'Download stereo mix WAV'})).toHaveAttribute('download','atlas-sonic-mix.wav');
    expect(screen.getByLabelText('Stereo mix preview')).not.toHaveAttribute('autoplay');
    fireEvent.click(screen.getByLabelText('Mute track 1'));
    await waitFor(()=>expect(screen.queryByRole('link',{name:'Download stereo mix WAV'})).not.toBeInTheDocument());
    expect(revoke).toHaveBeenCalledWith('blob:sonic-mix');
  });
});

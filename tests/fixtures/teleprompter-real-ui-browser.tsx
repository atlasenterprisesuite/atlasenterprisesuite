import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { TeleprompterPage } from '../../apps/web/src/modules/creator/teleprompter/TeleprompterPage';

const result: Record<string, unknown> = {
  mode: 'actual_teleprompter_ui_synthetic_browser',
  realDevice: false,
  cloudBackend: 'isolated_stub',
  realSpeechRecognition: false
};
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until<T>(getter: () => T | null | undefined, timeout = 12000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = getter();
    if (value) return value;
    await sleep(100);
  }
  throw Error('ui_condition_timeout');
}
function button(label: string): HTMLButtonElement | null {
  return [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === label) || null;
}
function option(label: string): HTMLInputElement | null {
  return [...document.querySelectorAll('label')].find(node => node.textContent?.includes(label))?.querySelector('input[type="checkbox"]') || null;
}

class SyntheticSpeechRecognition {
  static current: SyntheticSpeechRecognition | null = null;
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  start() { SyntheticSpeechRecognition.current = this; }
  stop() { SyntheticSpeechRecognition.current = null; }
}
(window as any).webkitSpeechRecognition = SyntheticSpeechRecognition;
createRoot(document.getElementById('root')!).render(
  <MemoryRouter><TeleprompterPage /></MemoryRouter>
);

async function report(out: unknown) {
  await fetch('/__atlas_teleprompter_ui_report', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(out), cache: 'no-store'
  });
}
async function run() {
  try {
    await until(() => document.querySelector('h1')?.textContent === 'ATLAS Teleprompter Inteligente');
    const cloudOpt = await until(() => option('Guardar automáticamente en ATLAS'));
    if (cloudOpt.checked) throw Error('cloud_opt_in_missing');
    const localOpt = await until(() => option('Descargar automáticamente en este dispositivo'));
    if (localOpt.checked) localOpt.click();
    const camera = await until(() => button('Activar cámara'));
    camera.click();
    await until(() => button('Apagar cámara'));
    const preview = document.querySelector('video[aria-label="Camera preview"]') as HTMLVideoElement;
    await until(() => preview.videoWidth > 16 && preview.videoHeight > 16);
    result.cameraPreview = { width: preview.videoWidth, height: preview.videoHeight };
    const start = await until(() => button('Comenzar grabación'));
    start.click();
    await until(() => document.querySelector('.recording-dot.active'), 14000);
    await until(() => SyntheticSpeechRecognition.current, 4000);
    const speech = SyntheticSpeechRecognition.current!;
    if (speech.lang !== 'es-US') throw Error('unexpected_recognition_language:' + speech.lang);
    speech.onresult?.({ results: [[{ transcript: 'ATLAS Enterprise Suite Una plataforma Cada solución Control total Hola Mi nombre' }]] });
    await until(() => document.querySelectorAll('.teleprompter-reader .word.spoken').length >= 3, 5000);
    result.syntheticVoiceAdvanced = document.querySelectorAll('.teleprompter-reader .word.spoken').length;
    await sleep(2200);
    const stop = await until(() => button('Detener y guardar'));
    stop.click();
    const playback = await until(() => document.querySelector('video[aria-label="Reproducir video grabado"]') as HTMLVideoElement, 15000);
    await until(() => playback.videoWidth > 16 && playback.videoHeight > 16, 12000);
    const blob = await (await fetch(playback.currentSrc || playback.src)).blob();
    if (blob.size < 1024) throw Error('empty_component_recording');
    if (!button('Descargar video')) throw Error('local_download_missing');
    if ((window as any).__atlasProbeUploads !== 0) throw Error('unexpected_cloud_upload');
    result.video = { bytes: blob.size, mime: blob.type, width: playback.videoWidth, height: playback.videoHeight };
    result.autoCloud = cloudOpt.checked;
    result.uploadCalls = (window as any).__atlasProbeUploads;
    const lang = document.querySelector('select[aria-label="Guion"]') as HTMLSelectElement;
    lang.value = 'en';
    lang.dispatchEvent(new Event('change', { bubbles: true }));
    await until(() => document.querySelector('h1')?.textContent === 'ATLAS Smart Teleprompter');
    const optEn = await until(() => option('Automatically save to ATLAS'));
    if (optEn.checked) throw Error('english_auto_upload_enabled');
    result.languages = 'Spanish/English separate';
    result.ok = true;
    await report(result);
  } catch(error) {
    result.ok = false;
    result.error = String(error);
    result.currentUI = document.body.textContent?.slice(-900);
    await report(result);
  }
}
void run();

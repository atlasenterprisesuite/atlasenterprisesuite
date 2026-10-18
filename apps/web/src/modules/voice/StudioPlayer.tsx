import React, { useEffect, useId, useRef, useState } from 'react';

export function VoiceWave({ compact = false }: { compact?: boolean }) {
  const gradient = useId();
  return <svg className={compact ? 'studio-wave compact' : 'studio-wave'} viewBox="0 0 800 360" aria-hidden="true">
    <defs><linearGradient id={gradient}><stop stopColor="#efd0a0"/><stop offset=".5" stopColor="#9ac5da"/><stop offset="1" stopColor="#edcd9a"/></linearGradient></defs>
    {Array.from({ length: 112 }, (_, i) => {
      const x = i * 7.2; const envelope = 25 + 100 * Math.pow(Math.sin(i / 22), 2);
      return <line key={i} x1={x} x2={x} y1={180 - envelope} y2={180 + envelope * .5} stroke={i % 3 ? '#789dad' : '#e8c394'} strokeWidth="1" opacity={.25 + (i % 7) / 12}/>;
    })}
    {Array.from({ length: 28 }, (_, j) => <path key={j} d={Array.from({ length: 161 }, (_, i) => {
      const x = i * 5; const y = 170 + Math.sin(i / 18 + j / 55) * (55 + j * 1.7) + Math.cos(i / 33) * 19 + j * 2;
      return `${i ? 'L' : 'M'}${x},${y}`;
    }).join(' ')} fill="none" stroke={`url(#${gradient})`} strokeWidth=".9" opacity={.35 + j / 50}/>)}
  </svg>;
}

export function StudioPlayer({ src, title, compact = false, lang = 'es' }: { src: string; title: string; compact?: boolean; lang?: 'es' | 'en' }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => { setPlaying(false); setTime(0); setDuration(0); setError(''); }, [src]);
  const clock = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  async function toggle() {
    const audio = ref.current; if (!audio) return;
    if (audio.paused) {
      document.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
      try { await audio.play(); } catch { setError(lang === 'es' ? 'No se pudo reproducir el audio.' : 'Audio playback failed.'); }
    } else audio.pause();
  }
  return <div className={compact ? 'studio-player compact' : 'studio-player'}>
    <audio ref={ref} src={src} preload="metadata" aria-label={title} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onTimeUpdate={() => setTime(ref.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(Number.isFinite(ref.current?.duration) ? ref.current!.duration : 0)} onError={() => setError(lang === 'es' ? 'Audio no disponible.' : 'Audio unavailable.')}/>
    <button type="button" className="studio-play" onClick={toggle} aria-label={`${playing ? (lang === 'es' ? 'Pausar' : 'Pause') : (lang === 'es' ? 'Reproducir' : 'Play')} ${title}`}><span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span></button>
    {!compact && <><span>{clock(time)}</span><input aria-label={lang === 'es' ? 'Posición del audio' : 'Audio position'} type="range" min="0" max={duration || 0} step=".1" value={time} disabled={!duration} onChange={event => { if (ref.current) ref.current.currentTime = Number(event.target.value); setTime(Number(event.target.value)); }}/><span>{clock(duration)}</span></>}
    {compact && <VoiceWave compact/>}
    <a className="studio-download" href={src} download={`${title.replace(/[^\p{L}\p{N}]+/gu, '-')}.mp3`} aria-label={title === 'Generated narration' ? 'Download MP3' : `${lang === 'es' ? 'Descargar' : 'Download'} ${title}`}>↓</a>
    {error && <span role="alert">{error}</span>}
  </div>;
}

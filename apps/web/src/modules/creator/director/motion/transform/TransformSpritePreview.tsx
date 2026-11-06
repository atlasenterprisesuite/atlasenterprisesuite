import React, { useEffect, useState } from 'react';
import './transform-sprite-preview.css';

export type TransformSequence = Readonly<{ columns: number; rows: number; frames: number; fps: number }>;
export const TRANSFORM_F3_SEQUENCE: TransformSequence = Object.freeze({ columns: 3, rows: 3, frames: 9, fps: 5 });

export function validateTransformSequence(s: TransformSequence): boolean {
  return [s.columns, s.rows, s.frames, s.fps].every(Number.isInteger)
    && s.columns >= 1 && s.columns <= 12 && s.rows >= 1 && s.rows <= 12
    && s.frames >= 1 && s.frames <= 144 && s.frames <= s.columns * s.rows
    && s.fps >= 1 && s.fps <= 12;
}

export function TransformSpritePreview({
  src, sequence = TRANSFORM_F3_SEQUENCE, label = 'Transformación ilustrativa',
}: { src: string; sequence?: TransformSequence; label?: string }) {
  const [frame, setFrame] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { setFrame(0); setReady(false); setError(false); }, [src, sequence]);
  const local = /^\/[a-zA-Z0-9/_-]+\.png$/.test(src) && !src.split('/').includes('..');
  if (!validateTransformSequence(sequence) || !local) return <p role="alert">Secuencia o recurso no autorizado.</p>;
  const current = Math.min(frame, sequence.frames - 1);
  const col = current % sequence.columns;
  const row = Math.floor(current / sequence.columns);
  const x = sequence.columns === 1 ? 0 : (col / (sequence.columns - 1)) * 100;
  const y = sequence.rows === 1 ? 0 : (row / (sequence.rows - 1)) * 100;
  return <section className="atlas-transform-preview" aria-label={label}>
    <div className="atlas-transform-frame" role="img" aria-label={`${label}, fotograma ${current + 1} de ${sequence.frames}`}
      style={{ backgroundImage: ready ? `url(${JSON.stringify(src)})` : 'none', backgroundSize: `${sequence.columns * 100}% ${sequence.rows * 100}%`, backgroundPosition: `${x}% ${y}%` }} />
    <img src={src} alt="" hidden onLoad={e => {
      const img = e.currentTarget;
      const ok = img.naturalWidth > 0 && img.naturalHeight > 0 && img.naturalWidth % sequence.columns === 0 && img.naturalHeight % sequence.rows === 0;
      setReady(ok); setError(!ok);
    }} onError={() => { setReady(false); setError(true); }} />
    {error && <p role="alert">No se pudo validar el spritesheet.</p>}
    <div className="atlas-transform-controls">
      <button type="button" disabled={!ready} onClick={() => setFrame((current - 1 + sequence.frames) % sequence.frames)}>Anterior</button>
      <output aria-live="polite">{current + 1} / {sequence.frames}</output>
      <button type="button" disabled={!ready} onClick={() => setFrame((current + 1) % sequence.frames)}>Siguiente</button>
    </div>
    <p>Vista previa ilustrativa · reproducción manual · sin generación de video.</p>
  </section>;
}

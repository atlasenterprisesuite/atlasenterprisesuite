import { useEffect, useState } from 'react';

export function supportsWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function readSpatialPreferences(webglCheck: () => boolean = supportsWebGL) {
  const reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  return { reducedMotion, webglSupported: webglCheck() };
}

export function useSpatialPreferences() {
  const [preferences, setPreferences] = useState(() => readSpatialPreferences());

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPreferences({ reducedMotion: media.matches, webglSupported: supportsWebGL() });
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return preferences;
}

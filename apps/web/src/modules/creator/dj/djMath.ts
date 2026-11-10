export type DjGains = { a: number; b: number };

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Crossfader ranges from -1 (A) to +1 (B). Equal-power law. */
export function crossfadeGains(position: number): DjGains {
  const safe = clamp(position, -1, 1, 0);
  const angle = ((safe + 1) * Math.PI) / 4;
  return { a: Math.max(0, Math.cos(angle)), b: Math.max(0, Math.sin(angle)) };
}

export function normalizeDjLevel(value: number): number {
  return clamp(value, 0, 1, 0);
}

export function formatDjTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Deterministic playlist planning. Does not analyze source audio or infer metadata. */
export type MixTrackMetadata = {
  id: string;
  title: string;
  bpm: number | null;
  camelot: string | null;
};

export type MixCompatibility = {
  score: number | null;
  tempo: number | null;
  harmony: number | null;
  reasons: string[];
};

export const CAMELOT_KEYS = Array.from({ length: 12 }, (_, index) => [`${index + 1}A`, `${index + 1}B`]).flat();

export function normalizeCamelot(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return /^(?:[1-9]|1[0-2])[AB]$/.test(normalized) ? normalized : null;
}

export function normalizeBpm(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 40 && value <= 250 ? value : null;
}

function harmonicFit(first: string, second: string): number {
  const a = Number(first.slice(0, -1));
  const b = Number(second.slice(0, -1));
  const modeA = first.slice(-1);
  const modeB = second.slice(-1);
  if (a === b && modeA === modeB) return 100;
  if (a === b && modeA !== modeB) return 92;
  if (modeA === modeB && (Math.abs(a - b) === 1 || Math.abs(a - b) === 11)) return 88;
  return 0;
}

export function transitionCompatibility(from: MixTrackMetadata, to: MixTrackMetadata): MixCompatibility {
  const a = normalizeBpm(from.bpm);
  const b = normalizeBpm(to.bpm);
  const keyA = normalizeCamelot(from.camelot);
  const keyB = normalizeCamelot(to.camelot);
  let tempo: number | null = null;
  let harmony: number | null = null;
  const reasons: string[] = [];

  if (a !== null && b !== null) {
    // A half-time/double-time match is musically useful without modifying audio.
    const difference = Math.min(...[b / 2, b, b * 2].map(candidate => Math.abs(a - candidate) / a));
    tempo = Math.round(Math.max(0, 100 * (1 - difference / 0.16)));
    reasons.push(difference <= 0.04 ? 'Close tempo' : 'Tempo adjustment may be needed');
  } else {
    reasons.push('Tempo unknown: enter BPM manually');
  }
  if (keyA && keyB) {
    harmony = harmonicFit(keyA, keyB);
    reasons.push(harmony >= 88 ? 'Camelot-compatible keys' : 'Keys are not Camelot neighbors');
  } else {
    reasons.push('Key unknown: enter Camelot code manually');
  }
  if (tempo === null && harmony === null) return { score: null, tempo, harmony, reasons };
  const score = tempo !== null && harmony !== null
    ? Math.round(tempo * 0.6 + harmony * 0.4)
    : (tempo ?? harmony);
  return { score, tempo, harmony, reasons };
}

export function reorderMixTracks<T extends MixTrackMetadata>(tracks: readonly T[]): T[] {
  if (tracks.length < 3) return [...tracks];
  const remaining = tracks.slice(1);
  const ordered: T[] = [tracks[0]];
  while (remaining.length) {
    const previous = ordered[ordered.length - 1];
    let bestIndex = 0;
    let bestScore = -1;
    for (let index = 0; index < remaining.length; index += 1) {
      const score = transitionCompatibility(previous, remaining[index]).score ?? -1;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    ordered.push(remaining.splice(bestIndex, 1)[0]);
  }
  return ordered;
}

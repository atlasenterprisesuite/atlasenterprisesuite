/**
 * First-party, local-only subtitle and transcript operations.
 * Deliberately does not claim speech recognition or infer timestamps.
 * Caller must supply timed subtitles or edit cues against real video playback.
 */
export type CaptionCue = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export type CaptionFormat = 'srt' | 'vtt';

const MAX_SOURCE_CHARS = 2_000_000;
const MAX_CUES = 10_000;
const MAX_HOURS = 24;
const TIME_PATTERN = /^(?:(\d{2,}):)?(\d{2}):(\d{2})[.,](\d{3})$/;

function parseTimestamp(raw: string): number {
  const match = TIME_PATTERN.exec(raw.trim());
  if (!match) throw new Error('caption_invalid_timestamp');
  const hours = Number(match[1] || '0');
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = Number(match[4]);
  if (hours > MAX_HOURS || minutes > 59 || seconds > 59 ||
      (hours === MAX_HOURS && (minutes !== 0 || seconds !== 0 || millis !== 0))) {
    throw new Error('caption_invalid_timestamp');
  }
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function formatTimestamp(seconds: number, format: CaptionFormat): string {
  const millis = Math.round(seconds * 1000);
  const hours = Math.floor(millis / 3_600_000);
  const minutes = Math.floor(millis / 60_000) % 60;
  const remainingSeconds = Math.floor(millis / 1000) % 60;
  const fractions = millis % 1000;
  const pad = (n: number, digits = 2) => String(n).padStart(digits, '0');
  return [pad(hours), pad(minutes), pad(remainingSeconds)].join(':') +
    (format === 'srt' ? ',' : '.') + pad(fractions, 3);
}

/** Ensures a deterministic non-overlapping cue timeline; errors block export and render. */
export function validateTimedCaptions(cues: readonly CaptionCue[], durationSeconds?: number | null): string[] {
  const issues: string[] = [];
  if (cues.length > MAX_CUES) issues.push('caption_count_limit');
  if (durationSeconds != null && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
    issues.push('caption_invalid_duration');
  }
  const ids = new Set<string>();
  let previousEnd = -1;
  for (const cue of cues) {
    if (!cue.id || ids.has(cue.id)) issues.push('caption_duplicate_or_missing_id');
    ids.add(cue.id);
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) ||
        cue.start < 0 || cue.end <= cue.start || cue.end > MAX_HOURS * 3600) {
      issues.push('caption_invalid_interval');
    }
    if (Number.isFinite(cue.start) && cue.start < previousEnd - 0.0001) {
      issues.push('caption_overlapping_or_unsorted');
    }
    previousEnd = cue.end;
    if (!cue.text.trim() || cue.text.length > 4000) issues.push('caption_empty_or_too_long');
    if (durationSeconds != null && Number.isFinite(cue.end) && cue.end > durationSeconds + 0.001) {
      issues.push('caption_exceeds_video');
    }
  }
  return [...new Set(issues)];
}

export function parseTimedCaptions(input: string): CaptionCue[] {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!text || text.length > MAX_SOURCE_CHARS) throw new Error('caption_invalid_source_size');
  const blocks = text.split(/\n[ \t]*\n+/);
  const cues: CaptionCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trimEnd());
    const first = (lines[0] || '').trim();
    if (/^WEBVTT(?:[ \t]|$)/.test(first) || /^(NOTE|STYLE|REGION)(?:[ \t]|$)/.test(first)) continue;
    const timeLine = lines.findIndex(line => line.includes('-->'));
    if (timeLine < 0 || timeLine > 1) throw new Error('caption_missing_timing');
    const timing = /^\s*(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/.exec(lines[timeLine]);
    if (!timing) throw new Error('caption_invalid_timing_line');
    const caption = lines.slice(timeLine + 1).join('\n').trim();
    cues.push({
      id: 'cue-' + String(cues.length + 1),
      start: parseTimestamp(timing[1]),
      end: parseTimestamp(timing[2]),
      text: caption
    });
    if (cues.length > MAX_CUES) throw new Error('caption_count_limit');
  }
  if (!cues.length) throw new Error('caption_no_timed_cues');
  const problems = validateTimedCaptions(cues);
  if (problems.length) throw new Error(problems.join(', '));
  return cues;
}

export function serializeTimedCaptions(cues: readonly CaptionCue[], format: CaptionFormat): string {
  if (format !== 'srt' && format !== 'vtt') throw new Error('caption_invalid_format');
  const issues = validateTimedCaptions(cues);
  if (!cues.length || issues.length) throw new Error(issues.join(', ') || 'caption_no_timed_cues');
  const lines = cues.map((cue, index) => [
    ...(format === 'srt' ? [String(index + 1)] : []),
    formatTimestamp(cue.start, format) + ' --> ' + formatTimestamp(cue.end, format),
    cue.text
  ].join('\n')).join('\n\n');
  return format === 'vtt' ? 'WEBVTT\n\n' + lines + '\n' : lines + '\n';
}

export function cueAtTime(cues: readonly CaptionCue[], time: number): CaptionCue | null {
  if (!Number.isFinite(time) || time < 0) return null;
  return cues.find(cue => cue.start <= time && time < cue.end) || null;
}

function searchable(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

export function searchCaptions(cues: readonly CaptionCue[], query: string): CaptionCue[] {
  const needle = searchable(query.trim());
  if (!needle) return [...cues];
  return cues.filter(cue => searchable(cue.text).includes(needle));
}

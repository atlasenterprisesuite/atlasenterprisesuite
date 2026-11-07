import type { MotionCompositionSpec, MotionLayer, MotionTrack } from './types';

export type DataReelPoint = { label: string; value: string; sourceUrl: string };
export type DataReelInput = { id: string; title: string; points: DataReelPoint[]; durationSeconds: number };

export function isAllowedDataSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !!url.username || !!url.password || !host.includes('.')) return false;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
    if (/^(127|10|0|169\.254|192\.168)\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return host !== '[::1]';
  } catch {
    return false;
  }
}

export function parseDataReelRows(input: string): DataReelPoint[] {
  const lines = input.split(/\r?\n/).map(row => row.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error('Enter at least one sourced data row.');
  if (lines.length > 5) throw new Error('A data reel supports up to five rows.');
  return lines.map((line, index) => {
    const fields = line.split('|').map(field => field.trim());
    if (fields.length !== 3) throw new Error(`Row ${index + 1} must contain three fields separated by | (label | value | https://source).`);
    return { label: fields[0], value: fields[1], sourceUrl: fields[2] };
  });
}

function assertPoint(point: DataReelPoint, index: number): void {
  if (!point.label.trim() || point.label.length > 45 || /[\r\n]/.test(point.label)) throw new Error(`Row ${index + 1}: label is required (max 45 characters).`);
  if (!point.value.trim() || point.value.length > 32 || /[\r\n]/.test(point.value)) throw new Error(`Row ${index + 1}: value is required (max 32 characters).`);
  if (!isAllowedDataSourceUrl(point.sourceUrl)) throw new Error(`Row ${index + 1}: source must be a public HTTPS URL without credentials.`);
}

function textLayer(
  id: string,
  name: string,
  startSecond: number,
  endSecond: number,
  positionY: number,
  dataReelRole: NonNullable<MotionLayer['dataReelRole']>,
  sourceUrl?: string
): MotionLayer {
  return {
    id, name, kind: 'text', sceneId: null, parentLayerId: null,
    startSecond, endSecond, visible: true, locked: false,
    transform: { positionX: 0, positionY, scaleX: 1, scaleY: 1, opacity: 1 },
    tracks: [], effects: [], expression: null,
    dataReelRole,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(dataReelRole === 'value' ? { sourceClaim: name } : {})
  };
}

export function createDataReelComposition(input: DataReelInput): MotionCompositionSpec {
  if (!/^[a-zA-Z0-9][\w-]{0,79}$/.test(input.id)) throw new Error('A stable reel id is required.');
  const title = input.title.trim();
  if (!title || title.length > 80 || /[\r\n]/.test(title)) throw new Error('A reel title is required (max 80 characters).');
  if (!input.points.length) throw new Error('Enter at least one sourced data point.');
  if (input.points.length > 5) throw new Error('A reel supports up to five data points.');
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 2 + input.points.length * 3 || input.durationSeconds > 120) {
    throw new Error('Reel duration must allow at least three seconds per point plus a two-second introduction (max 120 seconds).');
  }
  input.points.forEach(assertPoint);
  const durationSeconds = input.durationSeconds;
  const segment = (durationSeconds - 2) / input.points.length;
  const layers: MotionLayer[] = [textLayer(`${input.id}-title`, title, 0, 2, -70, 'title')];

  input.points.forEach((point, index) => {
    const start = 2 + index * segment;
    const end = index === input.points.length - 1 ? durationSeconds : 2 + (index + 1) * segment;
    const value = textLayer(`${input.id}-value-${index}`, `${point.label}: ${point.value}`, start, end, -35, 'value', point.sourceUrl);
    const track: MotionTrack = {
      id: `${value.id}-fade`, property: 'opacity',
      keyframes: [
        { id: `${value.id}-in-0`, time: start, value: 0, easing: { type: 'ease-out' } },
        { id: `${value.id}-in-1`, time: start + 0.4, value: 1, easing: { type: 'linear' } },
        { id: `${value.id}-out-0`, time: end - 0.4, value: 1, easing: { type: 'ease-in' } },
        { id: `${value.id}-out-1`, time: end, value: 0, easing: { type: 'linear' } }
      ]
    };
    value.tracks = [track];
    layers.push(value);
    layers.push(textLayer(`${input.id}-source-${index}`, `Source supplied (unverified): ${new URL(point.sourceUrl).hostname}`, start, end, 35, 'source', point.sourceUrl));
  });

  return {
    id: input.id, version: 1, template: 'data-reel-v1', dataReelCount: input.points.length,
    width: 1080, height: 1920, fps: 30, durationSeconds,
    background: '#0b1120', scenes: [], layers, markers: [],
    renderSettings: { quality: 'preview', motionBlur: false }
  };
}

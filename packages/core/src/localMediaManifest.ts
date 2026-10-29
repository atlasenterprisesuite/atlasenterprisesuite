export type LocalMediaCandidate = { name: string; size: number; type: string };
export type LocalMediaEntry = { name: string; size: number; kind: 'image' | 'video' | 'audio' | 'document' | 'other'; status: 'local_only' };
export type LocalMediaResult = { accepted: LocalMediaEntry[]; rejected: Array<{ name: string; reason: string }> };
const MAX_LOCAL_BYTES = 100 * 1024 * 1024;
const KIND_MIME: Record<string, LocalMediaEntry['kind']> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/heic': 'image',
  'video/mp4': 'video', 'video/quicktime': 'video', 'audio/mpeg': 'audio', 'audio/wav': 'audio',
  'application/pdf': 'document', 'text/plain': 'document'
};
/** Client-only preview manifest. Does not upload, authorize, persist or inspect file contents. */
export function buildLocalMediaManifest(files: readonly LocalMediaCandidate[]): LocalMediaResult {
  const accepted: LocalMediaEntry[] = [];
  const rejected: LocalMediaResult['rejected'] = [];
  for (const file of files) {
    if (!file.name || /[/\\\x00-\x1f]/.test(file.name) || file.name === '..' || file.name.includes('../')) {
      rejected.push({ name: file.name, reason: 'invalid_name' }); continue;
    }
    if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_LOCAL_BYTES) {
      rejected.push({ name: file.name, reason: 'invalid_size' }); continue;
    }
    const kind = KIND_MIME[file.type];
    if (!kind) { rejected.push({ name: file.name, reason: 'unsupported_type' }); continue; }
    accepted.push({ name: file.name, size: file.size, kind, status: 'local_only' });
  }
  return { accepted, rejected };
}

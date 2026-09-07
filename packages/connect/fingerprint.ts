import type { PublishDraft } from './types';

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\r\n/g, '\n');
}

export function fingerprintDraft(
  draft: Pick<PublishDraft, 'title' | 'body' | 'link' | 'contentType' | 'attachment'>
): string {
  const payload = JSON.stringify({
    title: normalizeText(draft.title),
    body: normalizeText(draft.body),
    link: normalizeText(draft.link),
    contentType: draft.contentType,
    attachment: draft.attachment
      ? {
          name: normalizeText(draft.attachment.name),
          mimeType: normalizeText(draft.attachment.mimeType).toLowerCase(),
          sizeBytes: draft.attachment.sizeBytes
        }
      : null
  });

  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fp1_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

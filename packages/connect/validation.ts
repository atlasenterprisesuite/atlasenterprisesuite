import type { PublishDestination, PublishDraft, ValidationResult } from './types';

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function attachmentMatchesType(draft: PublishDraft): boolean {
  if (!draft.attachment) return false;
  const mime = draft.attachment.mimeType.toLowerCase();
  if (draft.contentType === 'image') return mime.startsWith('image/');
  if (draft.contentType === 'video') return mime.startsWith('video/');
  if (draft.contentType === 'audio') return mime.startsWith('audio/');
  return true;
}

export function validateDraftForDestination(
  draft: PublishDraft,
  destination: PublishDestination
): ValidationResult {
  const errors: string[] = [];

  if (draft.destinationId !== destination.id) {
    errors.push('Destination does not match the selected publication target.');
  }

  if (!destination.supportedContentTypes.includes(draft.contentType)) {
    errors.push(`Content type ${draft.contentType} is not supported by this destination.`);
  }

  const body = draft.body.trim();
  const link = draft.link?.trim() ?? '';

  if ((draft.contentType === 'text' || draft.contentType === 'link') && !body && !link) {
    errors.push('Content is required before this publication can be marked ready.');
  }

  if (link && !isHttpUrl(link)) {
    errors.push('Link must be a valid http or https URL.');
  }

  if (draft.contentType === 'image' || draft.contentType === 'video' || draft.contentType === 'audio') {
    if (!draft.attachment) {
      errors.push(`An attachment is required for ${draft.contentType} content.`);
    } else if (!attachmentMatchesType(draft)) {
      errors.push(`Attachment MIME type does not match ${draft.contentType} content.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

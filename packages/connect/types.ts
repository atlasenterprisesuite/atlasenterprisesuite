export type PublicationCapability = 'manual_handoff' | 'provider_publish' | 'unavailable';

export type PublicationStatus =
  | 'draft'
  | 'ready'
  | 'awaiting_manual_publish'
  | 'publishing'
  | 'published'
  | 'failed';

export type ReceiptVerification = 'manual_confirmation' | 'provider_verified';

export type PublishContentType = 'text' | 'link' | 'image' | 'video' | 'audio' | 'poll';

export type PublicationAction =
  | 'mark_ready'
  | 'start_manual_handoff'
  | 'start_provider_publish'
  | 'confirm_manual_publish'
  | 'provider_succeeded'
  | 'fail'
  | 'retry';

export type AtlasPermission =
  | 'studio.draft.create'
  | 'studio.draft.edit'
  | 'connect.destination.read'
  | 'connect.publish.request'
  | 'connect.publish.confirm_manual'
  | 'connect.publish.retry'
  | 'connect.audit.read';

export interface PublishAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  objectUrl?: string;
}

export interface PublishDestination {
  id: string;
  platform: 'whatsapp_channel' | 'whatsapp_business' | 'instagram' | 'facebook' | 'x' | 'other';
  name: string;
  capability: PublicationCapability;
  publicUrl?: string;
  provider?: string;
  supportedContentTypes: PublishContentType[];
}

export interface PublishDraft {
  id: string;
  title: string;
  body: string;
  link: string | null;
  contentType: PublishContentType;
  attachment: PublishAttachment | null;
  destinationId: string;
  status: PublicationStatus;
  fingerprint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicationReceipt {
  id: string;
  publicationId: string;
  destinationId: string;
  verification: ReceiptVerification;
  fingerprint: string;
  actor: string;
  createdAt: string;
  providerReference: string | null;
}

export interface PublicationAuditEvent {
  id: string;
  publicationId: string;
  destinationId: string;
  capability: PublicationCapability;
  fingerprint: string | null;
  action:
    | 'draft_saved'
    | 'marked_ready'
    | 'handoff_started'
    | 'manual_publish_confirmed'
    | 'provider_publish_started'
    | 'provider_publish_succeeded'
    | 'publication_failed';
  actor: string;
  timestamp: string;
  outcome: 'success' | 'failure';
  verification: ReceiptVerification | null;
  providerReference: string | null;
  error: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

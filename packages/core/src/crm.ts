import type { IntegrationConnectionState } from './integrations';

export type CrmObjectType =
  | 'contact'
  | 'company'
  | 'deal'
  | 'ticket'
  | 'task'
  | 'call'
  | 'meeting'
  | 'note'
  | 'email';

export type CrmFieldValue = string | number | boolean | null;

export type CrmRecord = {
  provider: 'hubspot';
  objectType: CrmObjectType;
  providerId: string;
  displayName: string;
  fields: Record<string, CrmFieldValue>;
  updatedAt: string | null;
};

export type CrmPage = {
  records: CrmRecord[];
  nextCursor: string | null;
};

export type CrmAssociation = {
  provider: 'hubspot';
  fromObjectType: CrmObjectType;
  fromProviderId: string;
  toObjectType: CrmObjectType;
  toProviderId: string;
  associationType: string | null;
};

export type CrmAssociationPage = {
  associations: CrmAssociation[];
  nextCursor: string | null;
};

export const CRM_PROVIDER_ERROR_CODES = [
  'expired_credential',
  'forbidden_scope',
  'not_found',
  'validation_error',
  'rate_limited',
  'upstream_unavailable',
  'malformed_provider_response',
  'unknown_upstream_error'
] as const;

export type CrmProviderErrorCode = (typeof CRM_PROVIDER_ERROR_CODES)[number];

export type CrmProviderError = {
  code: CrmProviderErrorCode;
  message: string;
  retryAfterSeconds?: number;
};

export type CrmConnectionView = {
  provider: 'hubspot';
  state: IntegrationConnectionState;
  providerAccountId: string | null;
  providerAccountLabel: string | null;
  grantedScopes: string[];
  lastVerifiedAt: string | null;
  lastSuccessAt: string | null;
  safeErrorCode: string | null;
};

export type CrmListRequest = {
  objectType: CrmObjectType;
  limit?: number;
  cursor?: string | null;
};

export type CrmSearchRequest = CrmListRequest & {
  query: string;
};

export type CrmGetRequest = {
  objectType: CrmObjectType;
  providerId: string;
};

export type CrmAssociationRequest = CrmGetRequest & {
  targetObjectType?: CrmObjectType;
  cursor?: string | null;
};

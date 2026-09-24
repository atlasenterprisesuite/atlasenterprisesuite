import {
  getActiveAtlasOrganization,
  getAtlasAccessToken,
  getCachedAtlasShellOrganization
} from './atlasSession';
import type {
  ComplianceAuditEvent,
  CompliancePermission,
  ComplianceRequirement,
  ComplianceSubmission
} from '../../../../packages/compliance/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

export type RideComplianceReadiness = {
  ok: true;
  service: 'atlas-ride-compliance';
  version: number;
  organization_id: string;
  tenant_id: string;
  role: string;
  permissions: CompliancePermission[];
  review_mode: 'manual';
  automated_identity_provider_connected: false;
  checked_at: string;
};

export type RideProfilePhotoResponse = {
  ok: true;
  requirement: ComplianceRequirement | null;
  submission: ComplianceSubmission | null;
  permissions: CompliancePermission[];
};

export type RideSubmissionResponse = {
  ok: true;
  requirement: ComplianceRequirement;
  submission: ComplianceSubmission;
};

export type RideTimelineResponse = {
  ok: true;
  events: ComplianceAuditEvent[];
};

export type RidePreviewResponse = {
  ok: true;
  signed_url: string;
  expires_in: number;
};

export class RideComplianceApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function query(api: string, params: Record<string, string | undefined> = {}) {
  const search = new URLSearchParams({ api });
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({ error: 'invalid_response' }));
  if (!response.ok) {
    const code = String(data?.error || `request_failed_${response.status}`);
    throw new RideComplianceApiError(code, response.status);
  }
  return data as T;
}

function storedOrganizationId() {
  if (typeof window === 'undefined') return '';
  return String(window.localStorage.getItem('atlas_org_id') || '').trim();
}

async function resolveRideOrganizationId() {
  const selected = storedOrganizationId();
  if (selected) return selected;

  const cached = getCachedAtlasShellOrganization();
  if (cached?.id) return cached.id;

  const organization = await getActiveAtlasOrganization();
  return organization.id;
}

function requestHeaders(token: string, organizationId: string, jsonBody: boolean) {
  return {
    apikey: PUBLISHABLE_KEY,
    authorization: `Bearer ${token}`,
    'x-atlas-org-id': organizationId,
    ...(jsonBody ? { 'content-type': 'application/json' } : {})
  };
}

async function requestWithRetry<T>(
  api: string,
  params: Record<string, string | undefined>,
  init: RequestInit,
  jsonBody: boolean
): Promise<T> {
  let token = getAtlasAccessToken();
  if (!token) throw new RideComplianceApiError('authentication_required', 401);

  const organizationId = await resolveRideOrganizationId();
  const url = `${SUPABASE_URL}/functions/v1/atlas-ride-compliance?${query(api, params)}`;
  const request = (accessToken: string) => fetch(url, {
    ...init,
    headers: {
      ...requestHeaders(accessToken, organizationId, jsonBody),
      ...(init.headers || {})
    }
  });

  let response = await request(token);
  if (response.status === 401) {
    await getActiveAtlasOrganization();
    token = getAtlasAccessToken();
    if (!token) throw new RideComplianceApiError('session_expired', 401);
    response = await request(token);
  }
  return parseResponse<T>(response);
}

function jsonRequest<T>(api: string, params: Record<string, string | undefined> = {}, init: RequestInit = {}) {
  return requestWithRetry<T>(api, params, init, true);
}

export function getRideComplianceReadiness() {
  return jsonRequest<RideComplianceReadiness>('readiness');
}

export function getRideProfilePhotoRequirement() {
  return jsonRequest<RideProfilePhotoResponse>('profile-photo');
}

export function submitRideProfilePhoto(file: File) {
  const form = new FormData();
  form.append('photo', file);
  return requestWithRetry<RideSubmissionResponse>('submit-profile-photo', {}, { method: 'POST', body: form }, false);
}

export function getRideComplianceTimeline(requirementId: string) {
  return jsonRequest<RideTimelineResponse>('timeline', { requirement_id: requirementId });
}

export function getRideCompliancePreview(submissionId: string) {
  return jsonRequest<RidePreviewResponse>('preview', { submission_id: submissionId });
}

export function approveRideComplianceSubmission(submissionId: string) {
  return jsonRequest<RideSubmissionResponse>('approve', {}, {
    method: 'POST',
    body: JSON.stringify({ submission_id: submissionId })
  });
}

export function rejectRideComplianceSubmission(submissionId: string, reason: string) {
  return jsonRequest<RideSubmissionResponse>('reject', {}, {
    method: 'POST',
    body: JSON.stringify({ submission_id: submissionId, reason })
  });
}

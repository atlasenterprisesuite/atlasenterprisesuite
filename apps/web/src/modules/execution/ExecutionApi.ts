import { getActiveAtlasOrganization, getAtlasAccessToken } from '../../lib/atlasSession';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

export type AtlasApprovalListItem = {
  id: string;
  task_id: string;
  step_id: string | null;
  module: string;
  action_summary: string;
  risk_class: 'low' | 'moderate' | 'high' | 'regulated';
  intended_external_effect: string | null;
  status: 'pending' | 'approved' | 'denied' | 'cancelled' | 'expired';
  expires_at: string | null;
  created_at: string;
};

export type AtlasWorkflowRecord = {
  task_id: string;
  workflow_type: string;
  module: string;
  status: 'now' | 'next' | 'blocked' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'critical';
  current_step: string | null;
  next_action: string | null;
  blocked_reason: string | null;
  evidence_ids: string[];
  trace_id: string;
  updated_at: string;
  completed_at: string | null;
};

export interface ExecutionApiClient {
  listApprovals(): Promise<AtlasApprovalListItem[]>;
  approve(approvalId: string, reason?: string): Promise<void>;
  deny(approvalId: string, reason?: string): Promise<void>;
  getWorkflow(taskId: string): Promise<AtlasWorkflowRecord>;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text || 'invalid_response' };
  }
  if (!response.ok) throw new Error(String(body?.error || `Request failed (${response.status})`));
  return body as T;
}

async function executionContext() {
  const organization = await getActiveAtlasOrganization();
  const token = getAtlasAccessToken();
  if (!token) throw new Error('authentication_required');
  return { organization, token };
}

function headers(token: string, organizationId: string) {
  return {
    apikey: PUBLISHABLE_KEY,
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-atlas-org-id': organizationId
  };
}

async function callExecution<T>(api: string, init: RequestInit = {}): Promise<T> {
  const { organization, token } = await executionContext();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/atlas-execution?api=${encodeURIComponent(api)}`, {
    ...init,
    headers: { ...headers(token, organization.id), ...(init.headers || {}) }
  });
  return parseResponse<T>(response);
}

export const executionApi: ExecutionApiClient = {
  async listApprovals() {
    const { organization, token } = await executionContext();
    const filter = encodeURIComponent(`eq.${organization.id}`);
    const select = encodeURIComponent('id,task_id,step_id,module,action_summary,risk_class,intended_external_effect,status,expires_at,created_at');
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/atlas_approval_requests?org_id=${filter}&status=eq.pending&select=${select}&order=created_at.asc`,
      { method: 'GET', headers: headers(token, organization.id) }
    );
    return parseResponse<AtlasApprovalListItem[]>(response);
  },

  async approve(approvalId, reason) {
    await callExecution('approve', {
      method: 'POST',
      body: JSON.stringify({ approval_id: approvalId, ...(reason ? { reason } : {}) })
    });
  },

  async deny(approvalId, reason) {
    await callExecution('deny', {
      method: 'POST',
      body: JSON.stringify({ approval_id: approvalId, ...(reason ? { reason } : {}) })
    });
  },

  async getWorkflow(taskId) {
    const result = await callExecution<{ ok: true; workflow: AtlasWorkflowRecord }>(
      `workflow&task_id=${encodeURIComponent(taskId)}`,
      { method: 'GET' }
    );
    return result.workflow;
  }
};

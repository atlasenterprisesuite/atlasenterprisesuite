import type { TenantScope } from '../../core/src/index';

export type AtlasTaskState =
  | 'draft'
  | 'queued'
  | 'planning'
  | 'implementation'
  | 'review'
  | 'qa'
  | 'ci'
  | 'awaiting_human_approval'
  | 'approved'
  | 'deploying'
  | 'verified'
  | 'completed'
  | 'blocked'
  | 'failed'
  | 'cancelled';

export type AtlasArtifactRef = { id: string; kind: string; uri: string };
export type AtlasFinding = { id: string; summary: string; severity: 'info' | 'warning' | 'error' };
export type AtlasCommitRef = { repo: string; sha: string; url: string | null };
export type AtlasTestResult = { name: string; status: 'passed' | 'failed'; evidence: string | null };
export type AtlasApproval = { actorId: string; result: 'approved' | 'denied'; target: string; createdAt: string };
export type AtlasEventRef = { eventId: string; type: string };
export type AtlasDeploymentRef = { id: string; status: 'requested' | 'started' | 'verified' | 'failed'; url: string | null };

export interface AtlasTask {
  schemaVersion: 1;
  taskId: string;
  objective: string;
  requestedBy: string;
  scope: TenantScope;
  assignedAgents: string[];
  state: AtlasTaskState;
  artifacts: AtlasArtifactRef[];
  findings: AtlasFinding[];
  commits: AtlasCommitRef[];
  tests: AtlasTestResult[];
  approvals: AtlasApproval[];
  events: AtlasEventRef[];
  traceId: string | null;
  deployment: AtlasDeploymentRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface AtlasEvent {
  eventId: string;
  taskId: string;
  scope: TenantScope;
  type: string;
  actorId: string;
  agentId: string | null;
  providerId: string | null;
  outcome: 'success' | 'denied' | 'failed';
  correlationId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type IncidentRisk = 'low' | 'approval-required';

export interface IncidentDraft {
  module: string;
  summary: string;
  category: 'reversible' | 'destructive' | 'financial' | 'permissions' | 'security' | 'audit' | 'irreversible';
  organizationId?: string;
  tenantId?: string;
}

export interface IncidentEvidenceEnvelope {
  module: string;
  summary: string;
  category: IncidentDraft['category'];
  risk: IncidentRisk;
  organizationId?: string;
  tenantId?: string;
  createdAt: string;
}

export function classifyIncidentRisk(incident: IncidentDraft): IncidentRisk {
  return incident.category === 'reversible' ? 'low' : 'approval-required';
}

export function buildIncidentEvidenceEnvelope(incident: IncidentDraft, now = new Date()): IncidentEvidenceEnvelope {
  return {
    module: incident.module,
    summary: incident.summary,
    category: incident.category,
    risk: classifyIncidentRisk(incident),
    organizationId: incident.organizationId,
    tenantId: incident.tenantId,
    createdAt: now.toISOString()
  };
}

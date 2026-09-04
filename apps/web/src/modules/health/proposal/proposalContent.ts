export type ProposalSectionId =
  | 'executive-summary'
  | 'opportunities'
  | 'solution'
  | 'modules'
  | 'integrations'
  | 'security'
  | 'pilot'
  | 'kpis'
  | 'contact';

export type ProposalSection = {
  id: ProposalSectionId;
  title: string;
  body: string;
};

export const proposalSections: readonly ProposalSection[] = [
  {
    id: 'executive-summary',
    title: 'Executive Summary',
    body: 'ATLAS proposes a governed orchestration layer connecting operational, financial, workforce, facilities, research and patient-experience workflows without requiring a health system to discard every existing platform.'
  },
  {
    id: 'opportunities',
    title: 'Problems & Opportunities',
    body: 'Fragmented workflows, duplicated operational views, disconnected facility data and slow cross-department coordination create opportunities for a shared command layer.'
  },
  {
    id: 'solution',
    title: 'ATLAS Solution',
    body: 'A modular Smart Health Ecosystem with shared identity, permissions, audit, source-state governance and integration adapters.'
  },
  {
    id: 'modules',
    title: 'Module Portfolio',
    body: 'Eighteen connected ATLAS Health workspaces cover enterprise operations, clinical operations, finance, workforce, pharmacy, supply chain, facilities, security, research and public-health awareness.'
  },
  {
    id: 'integrations',
    title: 'Integrations',
    body: 'FHIR, HL7 v2, EHR, finance, workforce, pharmacy, facilities IoT, voice and public-health adapters are represented as contracts until an authorized live connection passes health checks.'
  },
  {
    id: 'security',
    title: 'Security & Governance',
    body: 'Tenant boundaries, RBAC, audit events, explicit source states and least-privilege integration administration govern every sensitive workflow.'
  },
  {
    id: 'pilot',
    title: 'Pilot Roadmap',
    body: 'Recommended pilot: Command Center + Patient Experience + Smart Facilities + Health Intelligence, followed by measured expansion into revenue, workforce, pharmacy and supply chain.'
  },
  {
    id: 'kpis',
    title: 'KPI Framework',
    body: 'Pilot KPIs should be baselined with authorized source data before targets are committed. Example categories include queue time, work-order cycle time, integration availability and operational response time.'
  },
  {
    id: 'contact',
    title: 'Request Pilot',
    body: 'This proposal workspace is an ATLAS concept environment and does not represent an AdventHealth deployment or endorsement.'
  }
];

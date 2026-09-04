import { Link } from 'react-router-dom';
import type { HealthModuleId, HealthOperationalRecord } from '../healthDomain';

export const moduleDomainLabels: Record<HealthModuleId, string> = {
  'enterprise-os': 'Sites & service lines', 'health-intelligence': 'Governed intelligence', 'patient-experience': 'Experience queues', 'clinical-operations': 'Operational throughput', 'finance-revenue': 'Revenue-cycle bridge', 'hr-workforce': 'Workforce coordination', 'smart-care': 'Remote care orchestration', 'pharmacy-4': 'Medication workflow', 'supply-chain': 'Critical stock visibility', 'ai-analytics': 'Model governance', 'research-innovation': 'Research governance', 'community-impact': 'Community programs', 'voice-assistant': 'Voice runtime', 'cleanscan-3d': 'Spatial capture', 'smart-facilities': 'Facilities work orders', 'energy-sustainability': 'Sustainability targets', 'safety-security': 'Security incidents', 'public-health-watch': 'Public-health bulletins'
};

const domainNotices: Partial<Record<HealthModuleId, string>> = { 'ai-analytics': 'Demo model output — not clinical decision support.', 'voice-assistant': 'Voice runtime unavailable until an authorized runtime is configured.', 'public-health-watch': 'Demo bulletin — not current public-health surveillance.', 'clinical-operations': 'Demo operational queues — not a live clinical census.', 'health-intelligence': 'Governed demo intelligence — not diagnosis or treatment advice.' };

export function ModuleOverview({ moduleId, records }: { moduleId: HealthModuleId; records: readonly HealthOperationalRecord[] }) {
  return <section className="health-stack"><h2>{moduleDomainLabels[moduleId]}</h2><p className="health-copy">{records.length} governed record{records.length === 1 ? '' : 's'} in the active demo scope.</p>{domainNotices[moduleId] ? <div className="notice strong">{domainNotices[moduleId]}</div> : null}{moduleId === 'finance-revenue' ? <Link className="health-secondary-action" to="/finance/accounting">Open ATLAS Accounting</Link> : null}{moduleId === 'hr-workforce' ? <div className="notice">Shared HR route is not configured in this release.</div> : null}</section>;
}

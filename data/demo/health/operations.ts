import type { HealthOperationalRecord } from '../../../packages/health/src';

const scope = { tenantId: 'tenant-demo', organizationId: 'org-demo', sourceState: 'demo' as const };

export const healthOperations: HealthOperationalRecord[] = [
  { ...scope, id: 'enterprise-1', moduleId: 'enterprise-os', title: 'Orlando campus operational review', status: 'active', category: 'site', detail: 'Demo cross-service operational checkpoint.' },
  { ...scope, id: 'intelligence-1', moduleId: 'health-intelligence', title: 'Throughput trend review', status: 'active', category: 'analysis', detail: 'Demo analysis only; not clinical decision support.' },
  { ...scope, id: 'experience-1', moduleId: 'patient-experience', title: 'Discharge follow-up queue', status: 'open', category: 'experience', detail: 'Synthetic queue record with no patient identifiers.' },
  { ...scope, id: 'clinical-1', moduleId: 'clinical-operations', title: 'Imaging coordination queue', status: 'open', category: 'throughput', detail: 'Demo operational queue, not a live census.' },
  { ...scope, id: 'finance-1', moduleId: 'finance-revenue', title: 'Claim exception review', status: 'open', category: 'revenue-cycle', detail: 'Demo revenue-cycle exception.' },
  { ...scope, id: 'workforce-1', moduleId: 'hr-workforce', title: 'Night-shift staffing review', status: 'open', category: 'staffing', detail: 'Synthetic workforce record.' },
  { ...scope, id: 'smart-care-1', moduleId: 'smart-care', title: 'Remote monitoring setup review', status: 'unavailable', category: 'integration', detail: 'Device integration is not configured.' },
  { ...scope, id: 'pharmacy-1', moduleId: 'pharmacy-4', title: 'Medication inventory reconciliation', status: 'active', category: 'inventory', detail: 'Demo inventory workflow only.' },
  { ...scope, id: 'supply-1', moduleId: 'supply-chain', title: 'Critical PPE stock flag', status: 'open', category: 'inventory', detail: 'Synthetic inventory threshold.' },
  { ...scope, id: 'ai-1', moduleId: 'ai-analytics', title: 'Throughput forecasting model review', status: 'active', category: 'model', detail: 'Demo model output; not clinical decision support.' },
  { ...scope, id: 'community-1', moduleId: 'community-impact', title: 'Community wellness outreach', status: 'active', category: 'program', detail: 'Demo community program.' },
  { ...scope, id: 'voice-1', moduleId: 'voice-assistant', title: 'Voice runtime configuration', status: 'unavailable', category: 'runtime', detail: 'Voice runtime unavailable.' },
  { ...scope, id: 'scan-1', moduleId: 'cleanscan-3d', title: 'North wing spatial capture', status: 'active', category: 'scan', detail: 'Demo spatial capture project.' },
  { ...scope, id: 'facility-1', moduleId: 'smart-facilities', title: 'MRI cooling inspection', status: 'open', category: 'maintenance', detail: 'Synthetic facilities work order.' },
  { ...scope, id: 'energy-1', moduleId: 'energy-sustainability', title: 'Cooling energy reduction target', status: 'active', category: 'energy', detail: 'Demo sustainability target.' },
  { ...scope, id: 'security-1', moduleId: 'safety-security', title: 'Visitor access incident review', status: 'open', category: 'incident', detail: 'Synthetic security event with no identity data.' },
  { ...scope, id: 'public-health-1', moduleId: 'public-health-watch', title: 'Demo respiratory illness bulletin', status: 'active', category: 'bulletin', detail: 'Demo bulletin; not current public-health surveillance.' }
];

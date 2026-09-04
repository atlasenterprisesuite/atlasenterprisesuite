import type { HealthPermission } from './permissions';
import type { HealthModuleId } from './types';

export type HealthModuleDefinition = {
  id: HealthModuleId;
  name: string;
  description: string;
  requiredPermission: HealthPermission;
  route: string;
};

const definitions: Omit<HealthModuleDefinition, 'route'>[] = [
  { id: 'enterprise-os', name: 'Enterprise OS', description: 'Hospital-wide sites, service lines and operational command.', requiredPermission: 'health.operations.read' },
  { id: 'health-intelligence', name: 'Health Intelligence', description: 'Governed operational and clinical intelligence views.', requiredPermission: 'health.clinical.read' },
  { id: 'patient-experience', name: 'Patient Experience', description: 'Journey, intake, communication and experience queues.', requiredPermission: 'health.patient_experience.read' },
  { id: 'clinical-operations', name: 'Clinical Operations', description: 'Care areas, queues, throughput and resource visibility.', requiredPermission: 'health.clinical.read' },
  { id: 'finance-revenue', name: 'Finance & Revenue', description: 'Revenue-cycle status and accounting integration points.', requiredPermission: 'health.finance.read' },
  { id: 'hr-workforce', name: 'HR & Workforce', description: 'Staffing, schedules, talent and payroll entry points.', requiredPermission: 'health.workforce.read' },
  { id: 'smart-care', name: 'Smart Care', description: 'Remote monitoring and telemedicine orchestration.', requiredPermission: 'health.operations.read' },
  { id: 'pharmacy-4', name: 'Pharmacy 4.0', description: 'Medication workflow, inventory and dispensing checkpoints.', requiredPermission: 'health.pharmacy.read' },
  { id: 'supply-chain', name: 'Supply Chain', description: 'Purchasing, inventory, vendors and requisitions.', requiredPermission: 'health.supply_chain.read' },
  { id: 'ai-analytics', name: 'AI & Analytics', description: 'Governed models, insights, explainability and confidence.', requiredPermission: 'health.operations.read' },
  { id: 'research-innovation', name: 'Research & Innovation', description: 'Governed research workspace and evidence controls.', requiredPermission: 'health.research.read' },
  { id: 'community-impact', name: 'Community Impact', description: 'Population-health, outreach and prevention programs.', requiredPermission: 'health.operations.read' },
  { id: 'voice-assistant', name: 'Voice & Virtual Assistant', description: 'Multilingual voice and assistant orchestration.', requiredPermission: 'health.operations.read' },
  { id: 'cleanscan-3d', name: 'CleanScan 3D', description: 'Facility scanning, spatial documentation and digital-twin intake.', requiredPermission: 'health.facilities.read' },
  { id: 'smart-facilities', name: 'Smart Facilities', description: 'Assets, rooms, maintenance and work orders.', requiredPermission: 'health.facilities.read' },
  { id: 'energy-sustainability', name: 'Energy & Sustainability', description: 'Resource use, targets and sustainability programs.', requiredPermission: 'health.facilities.read' },
  { id: 'safety-security', name: 'Safety & Security', description: 'Incidents, access events and security logs.', requiredPermission: 'health.security.read' },
  { id: 'public-health-watch', name: 'Public Health Watch', description: 'Governed public-health bulletins and epidemiological watch.', requiredPermission: 'health.operations.read' }
];

export const healthModuleCatalog: HealthModuleDefinition[] = definitions.map(item => ({
  ...item,
  route: `/health/operations/modules/${item.id}`
}));

export function moduleDefinition(moduleId: HealthModuleId) {
  return healthModuleCatalog.find(module => module.id === moduleId);
}

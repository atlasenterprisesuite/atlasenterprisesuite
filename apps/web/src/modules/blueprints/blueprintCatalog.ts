export type BlueprintImplementationStatus = 'implemented' | 'partial' | 'catalog';

export interface BlueprintRecord {
  id: string;
  title: string;
  domain: string;
  sourceLabel: string;
  provenance: 'library';
  moduleRoute?: string;
  implementationStatus: BlueprintImplementationStatus;
}

export const blueprintCatalog: BlueprintRecord[] = [
  { id: 'universe', title: 'ATLAS Universe Enterprise Dashboard', domain: 'Core / Universe', sourceLabel: 'Library · ATLAS Universe Enterprise Dashboard.png', provenance: 'library', moduleRoute: '/', implementationStatus: 'partial' },
  { id: 'enterprise-master', title: 'ATLAS Enterprise Suite Master', domain: 'Enterprise Suite', sourceLabel: 'Library · ATLAS Enterprise Suite: A Human-Centered Future.png', provenance: 'library', moduleRoute: '/', implementationStatus: 'partial' },
  { id: 'identity', title: 'ATLAS One Identity', domain: 'Identity / OS', sourceLabel: 'Library · ATLAS: One Identity, Brighter Tomorrow.png', provenance: 'library', moduleRoute: '/identity', implementationStatus: 'implemented' },
  { id: 'payroll', title: 'ATLAS Payroll: A Brighter Tomorrow', domain: 'Payroll', sourceLabel: 'Library · ATLAS Payroll: A Brighter Tomorrow.png', provenance: 'library', moduleRoute: '/payroll', implementationStatus: 'partial' },
  { id: 'crm', title: 'ATLAS CRM: One Connected Pipeline', domain: 'CRM & Sales', sourceLabel: 'Library · ATLAS CRM: One Connected Pipeline.png', provenance: 'library', implementationStatus: 'catalog' },
  { id: 'inventory', title: 'Atlas Inventory Command Center', domain: 'Inventory', sourceLabel: 'Library · Atlas Inventory Command Center.png', provenance: 'library', implementationStatus: 'catalog' },
  { id: 'venezuela', title: 'Venezuela ATLAS: A Futuristic Command Center', domain: 'Venezuela', sourceLabel: 'Library · Venezuela ATLAS: A Futuristic Command Center.png', provenance: 'library', implementationStatus: 'catalog' }
];

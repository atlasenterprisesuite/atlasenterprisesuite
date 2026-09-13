export type AtlasNavigationAvailability = 'implemented' | 'catalog';
export type AtlasNavigationGroup = 'core' | 'business' | 'people' | 'operations' | 'industry' | 'intelligence' | 'governance';

export interface AtlasNavigationItem {
  id: string;
  label: string;
  group: AtlasNavigationGroup;
  availability: AtlasNavigationAvailability;
  route?: string;
  requiresIdentity?: boolean;
}

export const atlasNavigation: AtlasNavigationItem[] = [
  { id: 'home', label: 'Home', group: 'core', availability: 'implemented', route: '/' },
  { id: 'business', label: 'Business Launch', group: 'business', availability: 'implemented', route: '/business' },
  { id: 'crm-sales', label: 'CRM & Sales', group: 'business', availability: 'catalog' },
  { id: 'finance', label: 'Finance', group: 'business', availability: 'implemented', route: '/finance' },
  { id: 'accounting', label: 'Accounting', group: 'business', availability: 'implemented', route: '/finance/accounting' },
  { id: 'payroll', label: 'Payroll', group: 'people', availability: 'implemented', route: '/payroll' },
  { id: 'hr', label: 'HR', group: 'people', availability: 'catalog' },
  { id: 'time', label: 'Time & Attendance', group: 'people', availability: 'catalog' },
  { id: 'recruiting', label: 'Recruiting', group: 'people', availability: 'catalog' },
  { id: 'projects', label: 'Projects', group: 'operations', availability: 'catalog' },
  { id: 'inventory', label: 'Inventory', group: 'operations', availability: 'catalog' },
  { id: 'purchasing', label: 'Purchasing', group: 'operations', availability: 'catalog' },
  { id: 'vendors', label: 'Vendors', group: 'operations', availability: 'catalog' },
  { id: 'pos', label: 'POS', group: 'operations', availability: 'catalog' },
  { id: 'atlas-pay', label: 'ATLAS Pay', group: 'operations', availability: 'catalog' },
  { id: 'health', label: 'Health OS', group: 'industry', availability: 'implemented', route: '/health' },
  { id: 'hospitality', label: 'Hospitality', group: 'industry', availability: 'implemented', route: '/hospitality/access' },
  { id: 'ride', label: 'Ride OS', group: 'industry', availability: 'catalog' },
  { id: 'studio', label: 'Creator Studio', group: 'industry', availability: 'implemented', route: '/studio', requiresIdentity: true },
  { id: 'telecom', label: 'Telecom', group: 'industry', availability: 'catalog' },
  { id: 'insurance', label: 'Insurance Hub', group: 'industry', availability: 'catalog' },
  { id: 'parks', label: 'Parks Global', group: 'industry', availability: 'catalog' },
  { id: 'autowash', label: 'AutoWash', group: 'industry', availability: 'catalog' },
  { id: 'venezuela', label: 'Venezuela', group: 'industry', availability: 'catalog' },
  { id: 'assistant', label: 'ATLAS Assistant', group: 'intelligence', availability: 'catalog' },
  { id: 'orchestrator', label: 'ATLAS Orchestrator', group: 'intelligence', availability: 'implemented', route: '/orchestrator', requiresIdentity: true },
  { id: 'blueprints', label: 'Blueprints', group: 'intelligence', availability: 'implemented', route: '/blueprints', requiresIdentity: true },
  { id: 'knowledge', label: 'Knowledge Atlas', group: 'intelligence', availability: 'catalog' },
  { id: 'voice', label: 'Voice', group: 'intelligence', availability: 'implemented', route: '/studio/voice', requiresIdentity: true },
  { id: 'connect', label: 'Connect', group: 'intelligence', availability: 'catalog' },
  { id: 'drive', label: 'Drive', group: 'intelligence', availability: 'catalog' },
  { id: 'cleanscan', label: 'CleanScan 3D', group: 'intelligence', availability: 'catalog' },
  { id: 'approvals', label: 'Approval Center', group: 'governance', availability: 'catalog' },
  { id: 'audit', label: 'Audit Trail', group: 'governance', availability: 'catalog' },
  { id: 'security', label: 'Security', group: 'governance', availability: 'catalog' },
  { id: 'settings', label: 'Settings', group: 'governance', availability: 'catalog' }
];

export function implementedNavigationItems(): AtlasNavigationItem[] {
  return atlasNavigation.filter((item) => item.availability === 'implemented');
}

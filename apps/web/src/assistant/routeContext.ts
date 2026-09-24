export function resolveAssistantModule(pathname: string): string {
  if (pathname.startsWith('/assistant')) return 'assistant';
  if (pathname.startsWith('/voice')) return 'voice';
  if (pathname.startsWith('/finance/accounting/accounts-payable')) return 'finance.accounting.accounts-payable';
  if (pathname.startsWith('/finance/accounting/accounts-receivable')) return 'finance.accounting.accounts-receivable';
  if (pathname.startsWith('/finance/accounting')) return 'finance.accounting';
  if (pathname.startsWith('/finance')) return 'finance';
  if (pathname.startsWith('/inventory/procure-to-pay')) return 'inventory.procure-to-pay';
  if (pathname.startsWith('/inventory')) return 'inventory';
  if (pathname.startsWith('/business/network')) return 'business.network';
  if (pathname.startsWith('/business')) return 'business';
  if (pathname.startsWith('/revenue')) return 'revenue';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/commerce')) return 'commerce';
  if (pathname.startsWith('/crm')) return 'crm';
  if (pathname.startsWith('/payroll')) return 'payroll';
  if (pathname.startsWith('/health/research/frontiers')) return 'health.research.frontiers';
  if (pathname.startsWith('/health/research')) return 'health.research';
  if (pathname.startsWith('/health')) return 'health';
  if (pathname.startsWith('/frontier')) return 'frontier';
  if (pathname.startsWith('/learning')) return 'learning';
  if (pathname.startsWith('/hospitality')) return 'hospitality';
  if (pathname.startsWith('/ride')) return 'ride';
  if (pathname.startsWith('/studio/voice')) return 'studio.voice';
  if (pathname.startsWith('/studio')) return 'studio';
  if (pathname.startsWith('/execution/manager')) return 'execution.manager';
  if (pathname.startsWith('/execution')) return 'execution';
  return 'atlas.home';
}

export function resolveAssistantModule(pathname: string): string {
  if (pathname.startsWith('/finance/accounting/accounts-payable')) return 'finance.accounting.accounts-payable';
  if (pathname.startsWith('/finance/accounting')) return 'finance.accounting';
  if (pathname.startsWith('/finance')) return 'finance';
  if (pathname.startsWith('/health/research/frontiers')) return 'health.research.frontiers';
  if (pathname.startsWith('/health/research')) return 'health.research';
  if (pathname.startsWith('/health')) return 'health';
  if (pathname.startsWith('/studio/voice')) return 'studio.voice';
  if (pathname.startsWith('/studio')) return 'studio';
  return 'atlas.home';
}

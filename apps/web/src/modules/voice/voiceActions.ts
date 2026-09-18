export type VoiceNavigationAction = {
  kind: 'navigate';
  route: string;
  label: string;
  confirmation: string;
};

type VoiceTarget = {
  route: string;
  label: string;
  aliases: string[];
};

const TARGETS: VoiceTarget[] = [
  { route: '/', label: 'Home', aliases: ['home', 'inicio', 'atlas home'] },
  { route: '/assistant', label: 'Assistant', aliases: ['assistant', 'asistente', 'chat', 'intelligence', 'inteligencia'] },
  { route: '/voice', label: 'Voice', aliases: ['voice', 'voz', 'atlas voice'] },
  { route: '/work', label: 'Work', aliases: ['work', 'trabajo'] },
  { route: '/finance', label: 'Finance', aliases: ['finance', 'finanzas'] },
  { route: '/finance/accounting', label: 'Accounting', aliases: ['accounting', 'contabilidad'] },
  { route: '/payroll', label: 'Payroll', aliases: ['payroll', 'nomina', 'payroll module'] },
  { route: '/business', label: 'Business', aliases: ['business', 'negocios', 'business suite'] },
  { route: '/crm', label: 'CRM', aliases: ['crm', 'customer relations', 'clientes'] },
  { route: '/commerce', label: 'Commerce', aliases: ['commerce', 'comercio', 'store'] },
  { route: '/health', label: 'Health', aliases: ['health', 'salud', 'atlas health'] },
  { route: '/hospitality', label: 'Hospitality', aliases: ['hospitality', 'hoteles', 'hotel'] },
  { route: '/ride', label: 'Ride', aliases: ['ride', 'movilidad', 'atlas ride'] },
  { route: '/connect', label: 'Connect', aliases: ['connect', 'conecta', 'communications', 'comunicaciones'] },
  { route: '/studio', label: 'Creator Studio', aliases: ['studio', 'creator', 'creator studio', 'estudio'] },
  { route: '/galaxy', label: 'Galaxy', aliases: ['galaxy', 'galaxia'] },
  { route: '/device-os', label: 'Device OS', aliases: ['device os', 'devices', 'dispositivos'] }
];

const ACTION_PREFIXES = [
  'open ',
  'go to ',
  'take me to ',
  'show ',
  'show me ',
  'abre ',
  'abrir ',
  've a ',
  'ir a ',
  'llevame a ',
  'muestra ',
  'muestrame '
];

export function normalizeVoiceCommand(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findTarget(value: string): VoiceTarget | null {
  const normalized = normalizeVoiceCommand(value);
  return TARGETS.find((target) => target.aliases.some((alias) => normalized === normalizeVoiceCommand(alias))) ?? null;
}

export function resolveVoiceNavigationCommand(transcript: string): VoiceNavigationAction | null {
  const normalized = normalizeVoiceCommand(transcript);
  if (!normalized) return null;

  const wakeMatch = normalized.match(/^(?:hey\s+)?atlas(?:\s+|$)/);
  const hadWakeWord = Boolean(wakeMatch);
  const withoutWakeWord = wakeMatch ? normalized.slice(wakeMatch[0].length).trim() : normalized;

  let requestedTarget = withoutWakeWord;
  const prefix = ACTION_PREFIXES.find((candidate) => requestedTarget.startsWith(candidate));
  if (prefix) {
    requestedTarget = requestedTarget.slice(prefix.length).trim();
  } else if (!hadWakeWord) {
    return null;
  }

  const target = findTarget(requestedTarget);
  if (!target) return null;

  return {
    kind: 'navigate',
    route: target.route,
    label: target.label,
    confirmation: `Opening ${target.label}.`
  };
}

export type AtlasLibrarySensitivity = 'organization' | 'restricted';

export type AtlasLibraryClassification = {
  primaryModuleId: string;
  moduleIds: string[];
  tags: string[];
  sensitivity: AtlasLibrarySensitivity;
  basis: 'path' | 'name' | 'content' | 'fallback';
};

const RESTRICTED_PATTERNS = [
  /(^|\/)(personal|registros personales|phone records|respaldos del teléfono|recuerdos familiares)(\/|$)/i,
  /(^|\/)(legal|loans|vivienda|housing)(\/|$)/i,
  /(^|\/)(03_health|health|care)(\/|$)/i,
  /(^|\/)(01_finance_tax|finance|tax|irs|accounting)(\/|$)/i,
  /(resume|curriculum|winder_aranguren|1040|transcript|receipt|recibo|invoice|bank|loan|kia|lyft|unemployment|reemployment)/i,
  /(health[ _-]?summary|patient[ _-]?health|medical[ _-]?(record|summary)|clinical[ _-]?record|lab[ _-]?results?)/i
];

const RULES: Array<{ module: string; tags: string[]; patterns: RegExp[] }> = [
  { module: 'tax', tags: ['tax'], patterns: [/\btax\b/i,/\birs\b/i,/1040/i,/schedule[_ -]?[acdef]/i,/1099/i,/w-?2/i] },
  { module: 'accounting', tags: ['accounting'], patterns: [/accounting/i,/accounts?[_ -]?(payable|receivable)/i,/smartledger/i,/general[_ -]?ledger/i,/journal/i] },
  { module: 'finance', tags: ['finance'], patterns: [/\bfinance\b/i,/financial/i,/business wallet/i,/invest(or|ment)/i] },
  { module: 'payroll', tags: ['payroll'], patterns: [/payroll/i,/timecard/i,/timesheet/i] },
  { module: 'people', tags: ['people','hr'], patterns: [/(^|[\/ _-])hr([\/ _-]|$)/i,/rrhh/i,/human resources/i,/resume/i,/career/i,/recruit/i] },
  { module: 'care', tags: ['care','caregiving'], patterns: [/atlas[ _-]?care/i,/caregiver/i,/care[ _-]?plan/i,/home[ _-]?care/i,/elder[ _-]?care/i] },
  { module: 'bible-os', tags: ['bible','scripture','religion'], patterns: [/bible/i,/biblia/i,/scripture/i,/escritura/i,/psalm/i,/salmo/i,/genesis/i,/g[eé]nesis/i,/exodus/i,/[ée]xodo/i,/jehov/i,/jes[uú]s/i,/christ/i,/cristo/i,/arc[aá]ngel/i,/religion/i,/religi[oó]n/i,/spiritual/i,/espiritual/i] },
  { module: 'knowledge', tags: ['knowledge','religion'], patterns: [/bible/i,/biblia/i,/scripture/i,/escritura/i,/psalm/i,/salmo/i,/genesis/i,/g[eé]nesis/i,/exodus/i,/[ée]xodo/i,/jehov/i,/jes[uú]s/i,/christ/i,/cristo/i,/arc[aá]ngel/i,/religion/i,/religi[oó]n/i,/spiritual/i,/espiritual/i] },
  { module: 'health', tags: ['health'], patterns: [/health/i,/salud/i,/cancer/i,/medical/i,/m[eé]dic/i,/disease/i,/enfermed/i,/hiv/i,/hospital/i,/acne/i,/acn[eé]/i,/dental/i,/periodont/i,/mucus/i,/moco/i,/cerumen/i] },
  { module: 'health', tags: ['health','weight','nutrition','wellness'], patterns: [/\bweight\b/i,/\bpeso\b/i,/\bbmi\b/i,/body[ _-]?mass/i,/nutrition/i,/nutrici[oó]n/i,/wellness/i,/bienestar/i,/fitness/i,/calori/i,/diet/i,/muscle/i,/m[uú]sculo/i] },
  { module: 'ride', tags: ['mobility'], patterns: [/ride/i,/lyft/i,/uber/i,/mobility/i,/gps/i,/vehicle/i,/kia/i,/cars/i,/transport/i] },
  { module: 'aviation', tags: ['aviation'], patterns: [/aviation/i,/aircraft/i,/flight/i] },
  { module: 'hospitality', tags: ['hospitality'], patterns: [/hospitality/i,/hotel/i,/resort/i,/onity/i] },
  { module: 'hospitality', tags: ['hospitality','food-service','restaurant'], patterns: [/restaurant/i,/restaurante/i,/fast[ _-]?food/i,/comida[ _-]?r[aá]pida/i,/food[ _-]?service/i,/caf[eé]/i,/kitchen/i,/cocina/i,/menu/i,/men[uú]/i,/mcdonald/i,/burger[ _-]?king/i,/wendy/i,/kfc/i,/chick[ _-]?fil/i,/subway/i,/taco[ _-]?bell/i] },
  { module: 'commerce', tags: ['commerce','food-catalog'], patterns: [/restaurant/i,/restaurante/i,/fast[ _-]?food/i,/comida[ _-]?r[aá]pida/i,/food[ _-]?service/i,/menu/i,/men[uú]/i,/ordering/i,/pedido/i] },
  { module: 'inventory', tags: ['inventory','operations'], patterns: [/inventory/i,/pallet/i,/warehouse/i,/purchas/i,/vendor/i,/procure/i] },
  { module: 'crm', tags: ['crm','sales'], patterns: [/crm/i,/hubspot/i,/prospect/i,/customer/i,/lead/i,/sales/i,/contacts/i] },
  { module: 'commerce', tags: ['commerce'], patterns: [/commerce/i,/pos/i,/checkout/i,/catalog/i,/product/i] },
  { module: 'analytics', tags: ['analytics'], patterns: [/analytics/i,/reporting/i,/dashboard/i,/metric/i] },
  { module: 'studio', tags: ['creative','media'], patterns: [/studio/i,/creator/i,/marketing/i,/branding/i,/brand/i,/logo/i,/poster/i,/flyer/i,/video/i,/reel/i,/music/i,/media/i,/photo/i,/image/i] },
  { module: 'voice', tags: ['voice','audio'], patterns: [/voice/i,/teleprompter/i,/audio/i,/\.mp3$/i,/\.wav$/i] },
  { module: 'connect', tags: ['communications'], patterns: [/connect/i,/communication/i,/email/i,/whatsapp/i,/telecom/i] },
  { module: 'learning', tags: ['education'], patterns: [/learning/i,/education/i,/study mode/i,/school/i,/course/i] },
  { module: 'insurance', tags: ['insurance'], patterns: [/insurance/i,/policy/i,/coverage/i] },
  { module: 'device-os', tags: ['device-os'], patterns: [/deviceos/i,/device os/i,/apple/i,/phone/i,/wearable/i] },
  { module: 'frontier', tags: ['frontier'], patterns: [/frontier/i,/galaxy/i,/space/i,/humanoid/i,/robotics/i] },
  { module: 'events', tags: ['events'], patterns: [/event/i,/entertainment/i,/concert/i] },
  { module: 'advisory', tags: ['advisory'], patterns: [/advisory/i,/business launch/i] },
  { module: 'release-control', tags: ['release','backup','devops'], patterns: [/backup/i,/repository/i,/source[_ -]?code/i,/release/i,/manifest/i,/audit/i,/deployment/i,/cloudflare/i,/github/i,/supabase/i] },
  { module: 'knowledge', tags: ['knowledge','geography','usa'], patterns: [/\busa\b/i,/united[ _-]?states/i,/estados[ _-]?unidos/i,/\bu\.s\.\b/i,/\bflorida\b/i,/\borlando\b/i,/\bamerica\b/i,/\bam[eé]rica\b/i] },
  { module: 'knowledge', tags: ['knowledge'], patterns: [/knowledge/i,/humanity/i,/reference/i,/research/i,/document/i,/archive/i] }
];

export function classifyAtlasLibraryAsset(input: {
  path?: string | null;
  name: string;
  mimeType?: string | null;
  contentText?: string | null;
}): AtlasLibraryClassification {
  const path = String(input.path || '');
  const name = String(input.name || '');
  const contentText = String(input.contentText || '');
  const metadataHaystack = `${path} ${name}`;
  const sensitivity: AtlasLibrarySensitivity = RESTRICTED_PATTERNS.some((pattern) => pattern.test(metadataHaystack))
    ? 'restricted'
    : 'organization';

  const pathMatches = RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(path)));
  const nameMatches = RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(name)));
  const contentMatches = contentText
    ? RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(contentText)))
    : [];
  const matchedRules = new Set([...pathMatches, ...nameMatches, ...contentMatches]);
  const matches = RULES.filter((rule) => matchedRules.has(rule));
  const moduleIds = [...new Set(matches.map((rule) => rule.module))];
  const tags = [...new Set(matches.flatMap((rule) => rule.tags))];

  if (moduleIds.length) {
    return {
      primaryModuleId: moduleIds[0],
      moduleIds,
      tags,
      sensitivity,
      basis: pathMatches.length ? 'path' : nameMatches.length ? 'name' : 'content'
    };
  }

  const mediaTag = input.mimeType?.startsWith('image/') ? 'image'
    : input.mimeType?.startsWith('video/') ? 'video'
    : input.mimeType?.startsWith('audio/') ? 'audio'
    : input.mimeType?.includes('pdf') ? 'document'
    : 'file';

  return {
    primaryModuleId: 'knowledge',
    moduleIds: ['knowledge'],
    tags: ['library', mediaTag],
    sensitivity,
    basis: 'fallback'
  };
}

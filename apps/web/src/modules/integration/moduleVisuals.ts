import type { AtlasModuleDefinition } from '../registry';

export type AtlasVisualFamily =
  | 'Intelligence'
  | 'Business'
  | 'Finance'
  | 'Platform'
  | 'Communications'
  | 'People'
  | 'Health'
  | 'Protection'
  | 'Creative'
  | 'Entertainment'
  | 'Hospitality'
  | 'Operations'
  | 'Mobility'
  | 'Spatial';

export type AtlasVisualSources = {
  640: string;
  1280: string;
  1920: string;
};

export type AtlasModuleVisual = {
  family: AtlasVisualFamily;
  focalPoint: string;
  alt: string;
  master: string;
  avif: AtlasVisualSources;
  webp: AtlasVisualSources;
};

function defineVisual(
  moduleId: string,
  family: AtlasVisualFamily,
  focalPoint = '50% 50%',
  alt = ''
): AtlasModuleVisual {
  const base = `/atlas/visuals/modules/${moduleId}`;
  return {
    family,
    focalPoint,
    alt,
    master: `${base}/master.webp`,
    avif: {
      640: `${base}/cover-640.avif`,
      1280: `${base}/cover-1280.avif`,
      1920: `${base}/cover-1920.avif`
    },
    webp: {
      640: `${base}/cover-640.webp`,
      1280: `${base}/cover-1280.webp`,
      1920: `${base}/cover-1920.webp`
    }
  };
}

export const MODULE_VISUALS = {
  'cloud': defineVisual('cloud', 'Platform', '68% 42%'),
  'work': defineVisual('work', 'Platform', '64% 48%'),
  'automations': defineVisual('automations', 'Platform', '62% 46%'),
  'assistant': defineVisual('assistant', 'Intelligence', '68% 45%'),
  'knowledge': defineVisual('knowledge', 'Intelligence', '65% 46%'),
  'bible-os': defineVisual('bible-os', 'Intelligence', '61% 45%'),
  'business': defineVisual('business', 'Business', '66% 45%'),
  'revenue': defineVisual('revenue', 'Business', '66% 48%'),
  'advisory': defineVisual('advisory', 'Business', '63% 44%'),
  'finance': defineVisual('finance', 'Finance', '67% 47%'),
  'accounting': defineVisual('accounting', 'Finance', '64% 48%'),
  'pay': defineVisual('pay', 'Finance', '68% 47%'),
  'tax': defineVisual('tax', 'Finance', '62% 46%'),
  'crm': defineVisual('crm', 'Business', '65% 46%'),
  'commerce': defineVisual('commerce', 'Business', '68% 48%'),
  'inventory': defineVisual('inventory', 'Operations', '66% 50%'),
  'analytics': defineVisual('analytics', 'Business', '67% 44%'),
  'connect': defineVisual('connect', 'Communications', '69% 43%'),
  'telecom': defineVisual('telecom', 'Communications', '66% 45%'),
  'people': defineVisual('people', 'People', '63% 46%'),
  'payroll': defineVisual('payroll', 'People', '64% 48%'),
  'learning': defineVisual('learning', 'People', '64% 44%'),
  'health': defineVisual('health', 'Health', '66% 44%'),
  'insurance': defineVisual('insurance', 'Protection', '65% 45%'),
  'studio': defineVisual('studio', 'Creative', '67% 45%'),
  'site-review': defineVisual('site-review', 'Creative', '63% 47%'),
  'voice': defineVisual('voice', 'Creative', '68% 45%'),
  'events': defineVisual('events', 'Entertainment', '66% 44%'),
  'frontier': defineVisual('frontier', 'Entertainment', '64% 45%'),
  'hospitality': defineVisual('hospitality', 'Hospitality', '67% 45%'),
  'ride': defineVisual('ride', 'Mobility', '68% 48%'),
  'gps': defineVisual('gps', 'Mobility', '65% 46%'),
  'city': defineVisual('city', 'Spatial', '66% 45%'),
  'aviation': defineVisual('aviation', 'Mobility', '68% 44%'),
  'galaxy': defineVisual('galaxy', 'Spatial', '66% 43%'),
  'device-os': defineVisual('device-os', 'Platform', '64% 46%'),
  'release-control': defineVisual('release-control', 'Platform', '63% 46%'),
  'execution': defineVisual('execution', 'Platform', '66% 46%')
} as const satisfies Record<string, AtlasModuleVisual>;

export const ATLAS_SUITE_VISUAL = defineVisual('suite', 'Platform', '66% 44%');

export function getModuleVisual(moduleId: AtlasModuleDefinition['id']): AtlasModuleVisual {
  const visual = MODULE_VISUALS[moduleId as keyof typeof MODULE_VISUALS];
  if (!visual) {
    throw new Error(`Missing ATLAS module visual contract: ${moduleId}`);
  }
  return visual;
}

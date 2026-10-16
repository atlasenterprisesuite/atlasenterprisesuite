import type { WebLaunchProfile } from './web_launch';

export type BrandExperienceInput = {
  productName: string;
  founderStory: string;
  destinationUrl: string;
};

export type BrandExperiencePack = {
  brand: string;
  product: string;
  headline: string;
  story: string;
  packagingNote: string;
  socialCaption: string;
  cta: string;
  destination: string | null;
  proofReview: string;
  language: 'en' | 'es';
};

export type BrandExperienceResult = {
  pack: BrandExperiencePack | null;
  errors: string[];
  warnings: string[];
};

function clean(value: string, max = 500): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Only explicit public HTTPS links are eligible for a handoff or printed QR destination. */
export function validateBrandDestination(input: string): string | null {
  const value = clean(input, 2048);
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username || url.password ||
      !host.includes('.') || host === 'localhost' ||
      host.endsWith('.localhost') || host.endsWith('.local') ||
      /^\[/.test(host) || /^\d+(?:\.\d+)*$/.test(host)
    ) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Deterministic, no-provider, no-network copy from user-supplied facts. */
export function buildBrandExperiencePack(
  profile: WebLaunchProfile,
  input: BrandExperienceInput
): BrandExperienceResult {
  const brand = clean(profile.brand, 100);
  const product = clean(input.productName, 100);
  const audience = clean(profile.audience, 160);
  const promise = clean(profile.promise, 240);
  const errors = [
    ...(!brand ? ['brand'] : []),
    ...(!product ? ['product'] : []),
    ...(!audience ? ['audience'] : []),
    ...(!promise ? ['promise'] : [])
  ];
  if (errors.length) return { pack: null, errors, warnings: [] };

  const storyInput = clean(input.founderStory, 1200);
  const proof = clean(profile.proof, 300);
  const action = clean(profile.primaryAction, 100);
  const destinationInput = clean(input.destinationUrl, 2048);
  const destination = validateBrandDestination(destinationInput);
  const spanish = profile.language.toLowerCase().startsWith('spanish');
  const warnings: string[] = [];
  if (!storyInput) warnings.push('Founder story missing: no brand history has been invented.');
  if (!proof) warnings.push('Evidence missing: do not publish measurable performance or impact claims.');
  else warnings.push('Evidence is user-supplied and must be independently verified before publication.');
  if (destinationInput && !destination) warnings.push('Link rejected: supply a public HTTPS URL; no QR destination is approved.');
  if (!destination) warnings.push('No approved destination: packaging QR must not be printed yet.');

  const pack: BrandExperiencePack = spanish
    ? {
        brand, product,
        headline: `${brand} · ${product}`,
        story: storyInput || 'No se proporcionó la historia de la marca. Añádela antes de publicarla.',
        packagingNote: `Gracias por elegir ${product} de ${brand}. Creado para ${audience}: ${promise}.`,
        socialCaption: `${brand} presenta ${product}: ${promise}. Para ${audience}.`,
        cta: action || 'Descubre más',
        destination,
        proofReview: proof ? `Afirmación proporcionada por el negocio (no verificada independientemente): ${proof}` : 'Sin evidencia aportada. No publicar afirmaciones de resultados medibles.',
        language: 'es'
      }
    : {
        brand, product,
        headline: `${brand} · ${product}`,
        story: storyInput || 'No founder story was supplied. Add an authentic brand story before publishing.',
        packagingNote: `Thank you for choosing ${brand}'s ${product}. Designed for ${audience}: ${promise}.`,
        socialCaption: `Meet ${product} from ${brand}: ${promise}. For ${audience}.`,
        cta: action || 'Discover more',
        destination,
        proofReview: proof ? `Business-supplied claim (not independently verified): ${proof}` : 'No evidence provided. Do not publish measurable result claims.',
        language: 'en'
      };

  return { pack, errors: [], warnings };
}

export function renderBrandExperienceText(pack: BrandExperiencePack): string {
  const header = pack.language === 'es' ? 'BORRADOR — REVISAR ANTES DE PUBLICAR' : 'DRAFT — REVIEW BEFORE PUBLISHING';
  return [
    header, pack.headline, '',
    'BRAND STORY', pack.story, '',
    'PACKAGING NOTE', pack.packagingNote, '',
    'SOCIAL CAPTION', pack.socialCaption, '',
    'ACTION', pack.cta, '',
    'PROOF REVIEW', pack.proofReview, '',
    'HTTPS DESTINATION', pack.destination || 'Not provided or not approved',
    '', 'This text is local draft output; it does not publish, generate a QR image, verify claims, or save media.'
  ].join('\n');
}

/**
 * ATLAS Studio / Content Intelligence: deterministic game-launch editorial seed.
 *
 * These are editorial hypotheses, NOT measured trends, game facts, footage,
 * licensing clearance, a connected provider, or approval to publish.
 * Director and Social Publisher remain the owners of production and delivery.
 */
export type GameLaunchLanguage = 'es' | 'en';
export type GameLaunchWindow = 'launch-48h' | 'evergreen';
export type GameLaunchIdea = {
  id: string;
  title: string;
  thumbnail: string;
  window: GameLaunchWindow;
  format: 'short' | 'long';
  capturePlan: string;
  evidenceStatus: 'unverified';
  performance: null;
};

type Template = readonly [
  spanishTitle: string, englishTitle: string,
  spanishThumbnail: string, englishThumbnail: string,
  sourceKind: 'official' | 'gameplay' | 'comparison',
  format: 'short' | 'long'
];

/** The first 10 topics are for the launch window; the next 20 are evergreen. */
const TEMPLATES: readonly Template[] = [
  ['Lo confirmado antes de jugar', 'What is confirmed before playing', 'CONFIRMADO', 'CONFIRMED', 'official', 'short'],
  ['Primeras impresiones sin spoilers', 'First impressions without spoilers', 'PRIMER VISTAZO', 'FIRST LOOK', 'gameplay', 'short'],
  ['Expectativas frente a experiencia', 'Expectations versus experience', '¿CUMPLE?', 'WORTH IT?', 'comparison', 'long'],
  ['Cómo empezar con seguridad', 'How to get started safely', 'GUÍA INICIAL', 'START HERE', 'gameplay', 'long'],
  ['Opciones de accesibilidad', 'Accessibility options reviewed', 'ACCESIBILIDAD', 'ACCESSIBILITY', 'gameplay', 'short'],
  ['Rendimiento en tu plataforma', 'Performance on your platform', 'RENDIMIENTO', 'PERFORMANCE', 'gameplay', 'long'],
  ['Controles y ajustes iniciales', 'First controls and settings', 'CONFIGURACIÓN', 'SETUP', 'gameplay', 'short'],
  ['Preguntas frecuentes del estreno', 'Launch frequently asked questions', 'PREGUNTAS', 'QUESTIONS', 'official', 'long'],
  ['Qué ofrece el mapa realmente', 'What the map actually offers', 'MAPA REAL', 'REAL MAP', 'gameplay', 'long'],
  ['Rumores y hechos comprobables', 'Rumors versus verified facts', 'HECHO O RUMOR', 'FACT OR RUMOR', 'official', 'short'],
  ['Guía de exploración sin spoilers', 'Spoiler-free exploration guide', 'EXPLORA', 'EXPLORE', 'gameplay', 'long'],
  ['Trucos que puedas verificar', 'Tips you can actually verify', 'A PRUEBA', 'TESTED', 'gameplay', 'short'],
  ['Errores comunes al comenzar', 'Common beginner mistakes', 'EVITA ESTO', 'AVOID THIS', 'gameplay', 'short'],
  ['Lo que revela la interfaz', 'What the interface reveals', 'INTERFAZ', 'INTERFACE', 'gameplay', 'long'],
  ['Cómo funcionan las misiones', 'How missions actually work', 'MISIONES', 'MISSIONS', 'gameplay', 'long'],
  ['Guía visual de movimientos', 'Visual movement guide', 'MOVIMIENTO', 'MOVEMENT', 'gameplay', 'short'],
  ['Comparación con su antecesor', 'Compared with the previous game', 'ANTES Y AHORA', 'THEN AND NOW', 'comparison', 'long'],
  ['Los cambios tras una actualización', 'Changes after an update', '¿QUÉ CAMBIÓ?', 'WHAT CHANGED?', 'official', 'short'],
  ['Configuración accesible de subtítulos', 'Accessible subtitle settings', 'SUBTÍTULOS', 'CAPTIONS', 'gameplay', 'short'],
  ['Consejos para sesiones cortas', 'Tips for shorter play sessions', 'GUÍA RÁPIDA', 'QUICK GUIDE', 'gameplay', 'short'],
  ['Análisis de vehículos disponibles', 'Available vehicles examined', 'VEHÍCULOS', 'VEHICLES', 'gameplay', 'long'],
  ['Mecánicas explicadas con ejemplos', 'Mechanics explained with examples', 'MECÁNICAS', 'MECHANICS', 'gameplay', 'long'],
  ['Sonido, música y ambientación', 'Audio, music and atmosphere', 'SONIDO', 'AUDIO', 'gameplay', 'long'],
  ['Cómo leer el mapa y sus señales', 'How to read the map and markers', 'SEÑALES', 'MAP MARKERS', 'gameplay', 'short'],
  ['Mitos que puedes poner a prueba', 'Myths you can put to the test', 'MITOS', 'MYTHS', 'comparison', 'short'],
  ['Detalles visuales documentados', 'Documented visual details', 'DETALLES', 'DETAILS', 'gameplay', 'short'],
  ['Preguntas de la comunidad', 'Community questions answered', 'COMUNIDAD', 'COMMUNITY', 'official', 'long'],
  ['Retos originales con reglas claras', 'Original challenges with clear rules', 'RETO ORIGINAL', 'NEW CHALLENGE', 'gameplay', 'long'],
  ['Qué sabemos de futuras mejoras', 'What we know about future updates', 'PRÓXIMAMENTE', 'UP NEXT', 'official', 'short'],
  ['Resumen de un mes de aprendizaje', 'One month of lessons learned', '1 MES DESPUÉS', 'ONE MONTH LATER', 'comparison', 'long']
];

const CAPTURE_PLAN: Record<GameLaunchLanguage, Record<Template[4], string>> = {
  es: {
    official: 'Consulta fuentes oficiales con fecha y URL; distingue anuncios de rumores. Usa solo material autorizado.',
    gameplay: 'Graba gameplay propio y comprueba cada afirmación en la versión exacta utilizada.',
    comparison: 'Compara evidencia con fuentes citables y grabaciones propias; separa opinión de hecho.'
  },
  en: {
    official: 'Check dated official sources and URLs; distinguish announcements from rumors. Use licensed materials only.',
    gameplay: 'Record your own gameplay and verify each claim in the exact version played.',
    comparison: 'Compare citable evidence with your own recordings; separate opinion from fact.'
  }
};

function shortTitle(name: string, suffix: string): string {
  const prefix = `${name}: `;
  const allowed = 60 - prefix.length;
  return prefix + (suffix.length <= allowed ? suffix : `${suffix.slice(0, allowed - 1).trimEnd()}…`);
}

export function buildGameLaunchIdeaPack(input: {
  gameName: string;
  language: GameLaunchLanguage;
}): GameLaunchIdea[] {
  const name = input.gameName.replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 20 || /[<>\x00-\x1F]/.test(name)) {
    throw new Error('game_name_invalid');
  }
  if (input.language !== 'es' && input.language !== 'en') throw new Error('game_language_invalid');

  return TEMPLATES.map((template, index) => {
    const isSpanish = input.language === 'es';
    return {
      id: `launch-game-${String(index + 1).padStart(2, '0')}`,
      title: shortTitle(name, template[isSpanish ? 0 : 1]),
      thumbnail: template[isSpanish ? 2 : 3],
      window: index < 10 ? 'launch-48h' : 'evergreen',
      format: template[5],
      capturePlan: CAPTURE_PLAN[input.language][template[4]],
      evidenceStatus: 'unverified',
      performance: null
    };
  });
}

export type GameLaunchHandoffEvidence = {
  identityVerified: boolean;
  tenantVerified: boolean;
  publisherPermissionVerified: boolean;
  sourceChecked: boolean;
  originalFootage: boolean;
  commercialRightsVerified: boolean;
  claimsVerified: boolean;
  captionsReady: boolean;
  transcriptReady: boolean;
  humanApproved: boolean;
  evidenceDigest: string | null;
};

/**
 * This is a local planning policy, never a server authorization.
 * Even an all-green client assertion cannot enable paid media, renders or publishing.
 */
export function assessGameLaunchHandoff(evidence: GameLaunchHandoffEvidence): {
  status: 'NO_GO' | 'REVIEW_REQUIRED';
  executable: false;
  blockers: string[];
} {
  const requirements: ReadonlyArray<readonly [keyof Omit<GameLaunchHandoffEvidence, 'evidenceDigest'>, string]> = [
    ['identityVerified', 'identity_unverified'],
    ['tenantVerified', 'tenant_unverified'],
    ['publisherPermissionVerified', 'publisher_permission_unverified'],
    ['sourceChecked', 'source_unverified'],
    ['originalFootage', 'original_footage_unverified'],
    ['commercialRightsVerified', 'rights_unverified'],
    ['claimsVerified', 'claims_unverified'],
    ['captionsReady', 'captions_missing'],
    ['transcriptReady', 'transcript_missing'],
    ['humanApproved', 'human_review_missing']
  ];
  const blockers = requirements.filter(([key]) => evidence[key] !== true).map(([, code]) => code);
  if (!/^[a-fA-F0-9]{64}$/.test(evidence.evidenceDigest || '')) blockers.push('evidence_digest_missing');
  return {
    status: blockers.length > 0 ? 'NO_GO' : 'REVIEW_REQUIRED',
    executable: false,
    blockers
  };
}

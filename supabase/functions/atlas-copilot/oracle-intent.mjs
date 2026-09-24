const ORACLE_TERMS = [
  'oracle', 'oráculo', 'oraculo',
  'mystical card', 'mystical cards', 'cartas místicas', 'cartas misticas',
  'lectura de cartas', 'léeme las cartas', 'leeme las cartas',
  'mi lectura de cartas'
];

const READING_TERMS = /\b(lectura|reading|léeme|leeme|reflexión|reflexion|mensaje)\b/;
const ORACLE_FOCUS_TERMS = /\b(amor|love|relationship|relación|relacion|dinero|money|finanzas|financial|recursos|trabajo|work|career|carrera|empleo|emocional|emotional|emociones|feelings|espiritual|spiritual|alma|soul|completa|completo|full|seven|siete)\b/;
const CARD_TERMS = /\b(carta|cartas|card|cards)\b/;

function normalize(message) {
  return String(message || '').trim().toLocaleLowerCase('es');
}

function readingTypeFor(text) {
  if (/\b(amor|love|relationship|relación|relacion)\b/.test(text)) return 'love';
  if (/\b(dinero|money|finanzas|financial|recursos)\b/.test(text)) return 'money';
  if (/\b(trabajo|work|career|carrera|empleo)\b/.test(text)) return 'work';
  if (/\b(emocional|emotional|emociones|feelings)\b/.test(text)) return 'emotional';
  if (/\b(espiritual|spiritual|alma|soul)\b/.test(text)) return 'spiritual';
  if (/\b(completa|completo|full|seven|siete)\b/.test(text)) return 'full';
  return 'daily';
}

export function detectOracleIntent(message) {
  const text = normalize(message);
  if (!text) return null;

  const explicitOracle = ORACLE_TERMS.some((term) => text.includes(term));
  const readingLanguage = READING_TERMS.test(text);
  const cardReading = readingLanguage && CARD_TERMS.test(text);
  const focusedReading = readingLanguage && ORACLE_FOCUS_TERMS.test(text);

  if (!explicitOracle && !cardReading && !focusedReading) return null;
  return { readingType: readingTypeFor(text) };
}

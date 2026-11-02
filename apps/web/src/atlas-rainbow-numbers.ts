/** ATLAS Rainbow symbolic prompts. Reflective UI only; never predictive or financial advice. */
export const ATLAS_SYMBOLIC_NUMBERS = [
  { code: '111', label: 'Inicio', action: 'Da el primer paso concreto.' },
  { code: '222', label: 'Equilibrio', action: 'Revisa tus prioridades y recursos.' },
  { code: '333', label: 'Creatividad', action: 'Crea, aprende o comunica algo útil.' },
  { code: '444', label: 'Estabilidad', action: 'Protege y organiza tus bases.' },
  { code: '555', label: 'Transformación', action: 'Realiza una mejora comprobable.' },
  { code: '666', label: 'Responsabilidad', action: 'Reflexiona sobre tus hábitos y bienestar.' },
  { code: '777', label: 'Revisión', action: 'Verifica resultados con el protocolo 777 REVIEW.' },
  { code: '888', label: 'Prosperidad', action: 'Da un paso sostenible hacia nuevos ingresos.' },
  { code: '999', label: 'Culminación', action: 'Completa una tarea pendiente.' },
  { code: '11:11', label: 'Propósito', action: 'Dedica un momento a reflexionar u orar si lo deseas.' },
] as const;

export type AtlasSymbolicNumber = (typeof ATLAS_SYMBOLIC_NUMBERS)[number]['code'];

/** Exact match only: no personal profiling or inferred destiny. */
export function getAtlasSymbolicPrompt(code: string) {
  return ATLAS_SYMBOLIC_NUMBERS.find((entry) => entry.code === code) ?? null;
}

export const ATLAS_NUMEROLOGY_NOTICE =
  'Interpretaciones simbólicas para reflexión personal. No predicen acontecimientos, loterías ni resultados financieros.';

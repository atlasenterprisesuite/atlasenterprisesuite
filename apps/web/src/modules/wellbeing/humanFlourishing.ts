export type FlourishingMode = 'secular' | 'christian';
export type FlourishingDimension = {
  id: string;
  title: string;
  description: string;
  action: string;
  route: string;
};
export const DEFAULT_FLOURISHING_MODE: FlourishingMode = 'secular';
export const FLOURISHING_DIMENSIONS: readonly FlourishingDimension[] = [
  { id: 'purpose', title: 'Propósito y valores', description: 'Reflexiona sobre lo que da sentido a tus decisiones.', action: 'Escribe mentalmente una intención para hoy.', route: '/knowledge/bible' },
  { id: 'wisdom', title: 'Sabiduría', description: 'Aprende, contrasta fuentes y decide con prudencia.', action: 'Investiga una pregunta antes de actuar.', route: '/learning' },
  { id: 'health', title: 'Salud', description: 'Reserva espacio para el descanso y el autocuidado.', action: 'Elige un hábito de bienestar alcanzable.', route: '/health' },
  { id: 'stability', title: 'Estabilidad', description: 'Planifica tus recursos sin presiones ni promesas.', action: 'Revisa una prioridad de tu presupuesto.', route: '/finance' },
  { id: 'opportunity', title: 'Oportunidades', description: 'Identifica pasos realistas para avanzar.', action: 'Define un siguiente paso verificable.', route: '/business' },
  { id: 'connection', title: 'Amor y relaciones', description: 'Cultiva relaciones respetuosas y límites sanos.', action: 'Piensa en un gesto de cuidado voluntario.', route: '/care' },
  { id: 'peace', title: 'Paz interior', description: 'Date permiso para detenerte y reflexionar.', action: 'Haz una pausa breve sin exigencias.', route: '/assistant' }
];
export function reflectionForMode(mode: FlourishingMode) {
  return mode === 'christian'
    ? { title: 'Reflexión cristiana opcional', body: 'Santiago 1:5 invita a pedir sabiduría. Reflexiona con libertad, sin atribuir a ATLAS autoridad divina.', source: 'Santiago 1:5 · referencia bíblica' }
    : { title: 'Reflexión personal', body: 'Puedes avanzar con un paso pequeño, consciente y coherente con tus valores.', source: 'Orientación secular · contenido de ATLAS' };
}

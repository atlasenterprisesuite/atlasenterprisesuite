import type { OracleCard } from './types';

export const ORACLE_CARDS: readonly OracleCard[] = [
  {
    id: 'confia',
    slug: 'confia',
    title: 'CONFÍA',
    shortMessage: 'Suelta el control y permite que la vida te guíe.',
    longMessage: 'Suelta el control y permite que la vida te guíe. Todo sucede en el momento perfecto.',
    category: 'trust'
  },
  {
    id: 'escucha',
    slug: 'escucha',
    title: 'ESCUCHA',
    shortMessage: 'Baja el ruido y presta atención a tu intuición.',
    longMessage: 'Tu intuición susurra la verdad que tu mente aún no comprende. Silencia el ruido y escucha tu alma.',
    category: 'intuition'
  },
  {
    id: 'acepta',
    slug: 'acepta',
    title: 'ACEPTA',
    shortMessage: 'Reconoce lo que es para poder elegir tu siguiente paso.',
    longMessage: 'Lo que es, simplemente es. Desde la aceptación, encuentras paz y transformas tu realidad.',
    category: 'acceptance'
  },
  {
    id: 'luz-interior',
    slug: 'luz-interior',
    title: 'LUZ INTERIOR',
    shortMessage: 'Reconoce la claridad y fortaleza que ya existen en ti.',
    longMessage: 'Vuelve a tu centro y observa con honestidad la claridad, la capacidad y la fortaleza que ya existen en ti.',
    category: 'inner-light'
  },
  {
    id: 'intuicion',
    slug: 'intuicion',
    title: 'INTUICIÓN',
    shortMessage: 'Escucha la percepción interna sin confundirla con certeza objetiva.',
    longMessage: 'Observa las sensaciones e ideas que se repiten y úsalas como material de reflexión, contrastándolas con hechos cuando tomes decisiones importantes.',
    category: 'intuition'
  },
  {
    id: 'guia-divina',
    slug: 'guia-divina',
    title: 'GUÍA DIVINA',
    shortMessage: 'Busca dirección en valores, propósito y acciones concretas.',
    longMessage: 'Permite que tus valores, tu propósito y las oportunidades reales que tienes delante orienten el siguiente paso.',
    category: 'guidance'
  },
  {
    id: 'paz-del-alma',
    slug: 'paz-del-alma',
    title: 'PAZ DEL ALMA',
    shortMessage: 'Protege un espacio de calma antes de reaccionar.',
    longMessage: 'Haz espacio para descansar, ordenar lo que sientes y volver a una respuesta más serena antes de actuar.',
    category: 'peace'
  }
] as const;

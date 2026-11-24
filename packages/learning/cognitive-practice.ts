export const colors = ['rojo', 'azul', 'verde'] as const;
export type Color = typeof colors[number];
export const protocolVersion = 'practice-v0.1';

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function buildStroop(seed: number) {
  const random = rng(seed);
  const trials = colors.flatMap(word => colors.filter(ink => ink !== word).map(ink => ({word, ink})));
  for (const word of colors) trials.push({word, ink:word}, {word, ink:word});
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [trials[i], trials[j]] = [trials[j], trials[i]];
  }
  return trials;
}

export function normalizeAnswer(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g,' ');
}

export function countWords(value: string) {
  const words = value.split(/[,;\n]+/).map(normalizeAnswer).filter(Boolean);
  const unique = new Set(words).size;
  return {total:words.length, unique, repeated:words.length - unique};
}

export function scoreAnswers(answers: string[], keys: string[]) {
  return keys.reduce((sum,key,i) => {
    const answer = normalizeAnswer(answers[i] ?? '');
    return sum + Number(Boolean(answer) && answer === normalizeAnswer(key));
  },0);
}

export function buildDigits(seed: number) {
  const random = rng(seed);
  return [3,4,5,6].map((length,i) => {
    const digits = Array.from({length}, () => Math.floor(random()*10));
    const reverse = i % 2 === 1;
    return {digits, reverse, answer:(reverse ? [...digits].reverse() : digits).join('')};
  });
}

export function reactionSummary(trials: {correct:boolean;ms:number}[]) {
  const durations = trials.filter(t => t.correct && Number.isFinite(t.ms) && t.ms >= 0).map(t=>t.ms).sort((a,b)=>a-b);
  const middle = Math.floor(durations.length/2);
  const medianMs = !durations.length ? null : durations.length%2 ? durations[middle] : (durations[middle-1]+durations[middle])/2;
  return {correct:trials.filter(t=>t.correct).length,total:trials.length,medianMs};
}

export const recallForms = [
  { passage:'El martes, Elena visitó una biblioteca con una mochila azul. Compró tres manzanas y volvió en autobús.', prompts:['Día','Nombre','Lugar','Color de mochila','Cantidad (en número)','Transporte'], keys:['martes','elena','biblioteca','azul','3','autobús'] },
  { passage:'El jueves, Pablo visitó un museo con una mochila verde. Compró cuatro naranjas y volvió en tren.', prompts:['Día','Nombre','Lugar','Color de mochila','Cantidad (en número)','Transporte'], keys:['jueves','pablo','museo','verde','4','tren'] }
];

export const logicForms = [
  [{prompt:'2, 4, 8, 16, ¿?',options:['24','30','32'],answer:2},{prompt:'3, 6, 11, 18, ¿?',options:['25','27','29'],answer:1},{prompt:'A, C, F, J, ¿?',options:['M','N','O'],answer:2}],
  [{prompt:'3, 6, 12, 24, ¿?',options:['36','48','54'],answer:1},{prompt:'2, 5, 10, 17, ¿?',options:['26','24','28'],answer:0},{prompt:'B, D, G, K, ¿?',options:['P','Q','O'],answer:0}]
];

export const readingForms = [
  {passage:'Un grupo de estudiantes midió la temperatura de una plaza, un jardín y una calle al mediodía durante tres días. El jardín presentó la temperatura menor. Propusieron repetir las mediciones en otras estaciones.', questions:[{prompt:'¿Qué midieron?',options:['Humedad','Temperatura','Viento'],answer:1},{prompt:'¿Cuándo?',options:['Al mediodía','Al amanecer','De noche'],answer:0},{prompt:'¿Dónde fue menor?',options:['Plaza','Calle','Jardín'],answer:2}]},
  {passage:'Un grupo de estudiantes midió el ruido de una biblioteca, una estación y un parque por la mañana durante cuatro días. La biblioteca presentó el ruido menor. Propusieron repetir las mediciones en otros horarios.',questions:[{prompt:'¿Qué midieron?',options:['Luz','Ruido','Viento'],answer:1},{prompt:'¿Cuándo?',options:['Por la noche','Al mediodía','Por la mañana'],answer:2},{prompt:'¿Dónde fue menor?',options:['Biblioteca','Estación','Parque'],answer:0}]}
];

export type Lesson = {week:number;stage:string;title:string;goal:string;exercises:number[];reflection:string};
export const curriculum: Lesson[] = [
  {week:1,stage:'Exploración',title:'Atención consciente',goal:'Distinguir estímulos y reconocer distracciones.',exercises:[0,5],reflection:'¿Qué estrategia te ayudó a concentrarte?'},
  {week:2,stage:'Exploración',title:'Palabras y categorías',goal:'Organizar palabras por significado.',exercises:[1,5],reflection:'¿Qué categorías te ayudaron a recordar palabras?'},
  {week:3,stage:'Exploración',title:'Recuerdos organizados',goal:'Identificar detalles de un relato.',exercises:[2,3],reflection:'¿Cómo organizaste lo que recordabas?'},
  {week:4,stage:'Exploración',title:'Patrones y razonamiento',goal:'Explicar una regla con tus propias palabras.',exercises:[4,5],reflection:'¿Qué regla utilizaste?'},
  {week:5,stage:'Práctica',title:'Precisión antes que rapidez',goal:'Probar estrategias para reducir errores.',exercises:[0,4],reflection:'¿Qué cambió al priorizar la precisión?'},
  {week:6,stage:'Práctica',title:'Comunicación clara',goal:'Relacionar vocabulario con comprensión.',exercises:[1,5],reflection:'¿Cómo explicarías la lectura a otra persona?'},
  {week:7,stage:'Práctica',title:'Agrupar información',goal:'Probar agrupaciones y recuperación activa.',exercises:[2,3],reflection:'¿Te ayudó organizar la información en grupos?'},
  {week:8,stage:'Práctica',title:'Resolver y revisar',goal:'Comparar estrategias para resolver problemas.',exercises:[4,0],reflection:'¿Qué otra manera de resolverlo existe?'},
  {week:9,stage:'Aplicación',title:'Estudio consciente',goal:'Aplicar atención y recuerdo en una lectura.',exercises:[5,2],reflection:'¿Cómo usarías esta estrategia al estudiar?'},
  {week:10,stage:'Aplicación',title:'Explicar y recordar',goal:'Relacionar lenguaje y memoria de trabajo.',exercises:[1,3],reflection:'¿Qué explicación fue más fácil de recordar?'},
  {week:11,stage:'Aplicación',title:'Pensamiento crítico',goal:'Revisar la lógica y distinguir datos de inferencias.',exercises:[4,5],reflection:'¿Qué dato necesitarías para verificar una afirmación?'},
  {week:12,stage:'Aplicación',title:'Aprender a aprender',goal:'Elegir estrategias útiles para tareas cotidianas.',exercises:[0,1,2,3,4,5],reflection:'¿Qué estrategia quieres seguir practicando?'}
];
export function lessonForWeek(week:number){return curriculum.find(lesson=>lesson.week===week);}
export function recordPractice(previous:number[], exercise:number, voluntary:boolean){
  if(!voluntary || !Number.isInteger(exercise) || exercise<0 || exercise>5 || previous.includes(exercise))return previous;
  return [...previous,exercise];
}

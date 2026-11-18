import type { CreatorProfile } from './content_intelligence';

/**
 * Transcript-derived editorial themes, not independently verified business
 * opportunities or proof of monetization. Original concepts only.
 */
export const YOUTUBE_NICHE_VIDEO_2027 = {
  videoId: 'FG89iOZOG4I',
  title: 'Encontré Los UNICOS 10 NICHOS que Te Harán Ganar el Próximo 2027',
  creator: 'David Albarrán',
  publishedDate: '2026-11-12',
  durationSeconds: 916,
  claimsVerified: false,
  source: 'YouTube public page and transcript'
} as const;

export type YouTubeNiche2027 = {
  id: string;
  title: string;
  startSeconds: number;
  angle: string;
  originalAngle: string;
  originalEpisode: string;
  targetAudience: string;
  researchRequirement: string;
  editorialCaution: string;
};

export const YOUTUBE_NICHES_2027: readonly YouTubeNiche2027[] = [
  {
    id: 'illustrated-real-stories',
    title: 'Historias reales ilustradas',
    startSeconds: 30,
    angle: 'Documentales narrados con ilustración y una estructura de historia clara.',
    originalAngle: 'Reconstrucciones ilustradas de hechos históricos con fuentes primarias, fechas y límites de la evidencia.',
    originalEpisode: 'La decisión que cambió una ciudad: tres documentos y una línea de tiempo.',
    targetAudience: 'Personas curiosas por la historia y los hechos verificables',
    researchRequirement: 'Documentos fiables, derechos de las imágenes y separación entre hechos e ilustraciones.',
    editorialCaution: 'No presentar ilustraciones generadas como fotografías originales de los hechos.'
  },
  {
    id: 'alternate-game-lives',
    title: 'Vidas alternativas en videojuegos',
    startSeconds: 92,
    angle: 'Narraciones hipotéticas sobre la vida de personajes de videojuegos.',
    originalAngle: 'Explorar decisiones y sistemas de mundos virtuales con guiones propios y crítica transformativa.',
    originalEpisode: '¿Cómo cambiaría una aventura si cada elección tuviera una consecuencia permanente?',
    targetAudience: 'Jugadores interesados en narrativa, mecánicas y decisiones',
    researchRequirement: 'Revisar derechos del juego, uso de clips y diferenciación clara de la obra original.',
    editorialCaution: 'No reutilizar secuencias, arte o personajes protegidos como si fueran contenido propio.'
  },
  {
    id: 'human-body-science',
    title: 'Ciencia del cuerpo humano',
    startSeconds: 165,
    angle: 'Preguntas sorprendentes sobre anatomía y funcionamiento del cuerpo.',
    originalAngle: 'Microdocumentales educativos no gráficos con diagramas claros y fuentes de divulgación médica.',
    originalEpisode: '¿Por qué el cerebro puede interpretar mal lo que ven nuestros ojos?',
    targetAudience: 'Personas que quieren comprender biología cotidiana',
    researchRequirement: 'Contrastar información con bibliografía médica y evitar afirmaciones clínicas sin apoyo.',
    editorialCaution: 'Evitar imágenes explícitas, diagnósticos individuales y sensacionalismo sobre lesiones.'
  },
  {
    id: 'deep-sea-animals',
    title: 'Animales extraordinarios del océano',
    startSeconds: 225,
    angle: 'Biología y misterio de animales marinos poco conocidos.',
    originalAngle: 'Expediciones visuales basadas en investigación oceanográfica y diferencias entre mito y observación.',
    originalEpisode: 'Tres adaptaciones de animales abisales que parecen ciencia ficción.',
    targetAudience: 'Audiencia de ciencia, océanos y naturaleza',
    researchRequirement: 'Documentar especies, hábitat, imágenes utilizadas y fuente de cada afirmación.',
    editorialCaution: 'No presentar representaciones de IA como grabaciones reales de expediciones.'
  },
  {
    id: 'prehistoric-wildlife',
    title: 'Fauna prehistórica',
    startSeconds: 305,
    angle: 'Preguntas y comparaciones entre animales extinguidos.',
    originalAngle: 'Explicar fósiles, climas y adaptaciones con reconstrucciones identificadas y evidencia paleontológica.',
    originalEpisode: '¿Qué sabemos de verdad sobre los mamíferos de la última glaciación?',
    targetAudience: 'Personas interesadas en fósiles, prehistoria y ciencias naturales',
    researchRequirement: 'Distinguir evidencia fósil, reconstrucción científica y escenarios hipotéticos.',
    editorialCaution: 'Evitar repetir enfrentamientos sensacionalistas con el mismo guion y miniatura.'
  },
  {
    id: 'cat-behavior',
    title: 'Comportamiento y curiosidades de gatos',
    startSeconds: 410,
    angle: 'Cuidado y preguntas curiosas sobre comportamiento felino.',
    originalAngle: 'Observaciones de conducta, bienestar animal y mitos corregidos con referencias fiables.',
    originalEpisode: '¿Qué significa que un gato cambie su rutina de juego?',
    targetAudience: 'Familias y personas interesadas en el bienestar de sus gatos',
    researchRequirement: 'Consultar recursos de bienestar animal y evitar recomendaciones veterinarias no fundadas.',
    editorialCaution: 'No atribuir a animales emociones o diagnósticos que el video no puede demostrar.'
  },
  {
    id: 'jesus-history-faith',
    title: 'Jesús: historia, fuentes y fe',
    startSeconds: 480,
    angle: 'Relatos y enseñanzas religiosas con audiencia interesada.',
    originalAngle: 'Investigar fuentes históricas, textos y tradiciones distinguiendo historia documentada e interpretaciones de fe.',
    originalEpisode: 'Jesús de Nazaret: lo que sabemos por las fuentes más tempranas.',
    targetAudience: 'Audiencia interesada en historia del cristianismo y reflexión espiritual',
    researchRequirement: 'Citar fuentes primarias y estudios; distinguir hechos, interpretaciones y creencias.',
    editorialCaution: 'No transformar hipótesis históricas en hechos o atribuir citas no documentadas.'
  },
  {
    id: 'illustrated-reflections',
    title: 'Reflexiones ilustradas y motivación',
    startSeconds: 544,
    angle: 'Mensajes de reflexión y desarrollo personal con ilustración.',
    originalAngle: 'Historias originales sobre valores y decisiones, con imágenes propias y una voz respetuosa.',
    originalEpisode: 'Escuchar antes de responder: una historia sobre decisiones difíciles.',
    targetAudience: 'Personas interesadas en reflexión, diálogo y crecimiento personal',
    researchRequirement: 'Conservar autoría del guion y derechos de ilustraciones, música y narración.',
    editorialCaution: 'No prometer resultados emocionales ni reciclar un mismo guion genérico.'
  },
  {
    id: 'military-history',
    title: 'Historia militar documentada',
    startSeconds: 570,
    angle: 'Historia de eventos militares contada con recursos visuales.',
    originalAngle: 'Explicar causas, contextos y consecuencias históricas con mapas autorizados y mirada crítica.',
    originalEpisode: 'Cómo una decisión logística cambió el rumbo de una campaña histórica.',
    targetAudience: 'Audiencia de historia, geografía y análisis documental',
    researchRequirement: 'Consultar archivos y documentos históricos; contextualizar los testimonios.',
    editorialCaution: 'Evitar glorificación de la violencia, imágenes gráficas y recreaciones engañosas.'
  },
  {
    id: 'brand-business-stories',
    title: 'Empresas, marcas y decisiones comerciales',
    startSeconds: 672,
    angle: 'Casos de empresas, alimentos y decisiones polémicas de mercado.',
    originalAngle: 'Casos de estrategia empresarial con informes públicos, cronología y análisis financiero responsable.',
    originalEpisode: 'Qué revelan los informes de una marca sobre un cambio de producto.',
    targetAudience: 'Audiencia interesada en negocios, marcas y economía cotidiana',
    researchRequirement: 'Verificar cifras, derechos de clips y afirmaciones potencialmente perjudiciales sobre terceros.',
    editorialCaution: 'No inventar escándalos ni insinuar irregularidades sin fuentes suficientes.'
  }
];

export function youtubeNicheVideoUrl(niche: YouTubeNiche2027): string {
  return 'https://www.youtube.com/watch?v=' + YOUTUBE_NICHE_VIDEO_2027.videoId + '&t=' + niche.startSeconds + 's';
}

export function makeYouTubeNicheProfile(niche: YouTubeNiche2027): CreatorProfile {
  return {
    niche: niche.title,
    objective: 'Producir videos originales, contrastados y útiles sobre ' + niche.title,
    tone: 'Claro, riguroso, atractivo; distinguir hechos, hipótesis y opiniones.',
    platforms: ['youtube'],
    audience: niche.targetAudience,
    language: 'Español'
  };
}

export function makeYouTubeNicheResearchSeed(niche: YouTubeNiche2027): string {
  return [
    'Inspiración editorial: video ' + YOUTUBE_NICHE_VIDEO_2027.videoId +
      ' (t=' + niche.startSeconds + 's). Sus cifras de éxito y monetización no verificadas.',
    'Enfoque original ATLAS: ' + niche.originalAngle,
    'Propuesta inicial: ' + niche.originalEpisode,
    'Fuentes y permisos pendientes: ' + niche.researchRequirement,
    'Riesgo editorial: ' + niche.editorialCaution
  ].join('\n');
}

export type YouTubeNicheEvidence = {
  credibleSourcesChecked?: boolean | null;
  rightsChecked?: boolean | null;
  originalContributionChecked?: boolean | null;
  syntheticMediaDisclosureReviewed?: boolean | null;
  humanEditorialReview?: boolean | null;
};

export function assessYouTubeNicheEvidence(evidence: YouTubeNicheEvidence): {
  status: 'NO_GO' | 'REVIEW_REQUIRED';
  blockers: string[];
  mayPublish: false;
} {
  const requirements: Array<[keyof YouTubeNicheEvidence, string]> = [
    ['credibleSourcesChecked', 'Revisión de fuentes faltante o no verificada'],
    ['rightsChecked', 'Derechos de audio, video e imágenes faltantes o no verificados'],
    ['originalContributionChecked', 'Aporte editorial original no verificado'],
    ['syntheticMediaDisclosureReviewed', 'Declaración de contenido sintético no revisada'],
    ['humanEditorialReview', 'Revisión editorial humana pendiente']
  ];
  const blockers = requirements.filter(([key]) => evidence[key] !== true).map(([, reason]) => reason);
  return {
    status: blockers.length ? 'NO_GO' : 'REVIEW_REQUIRED',
    blockers,
    mayPublish: false
  };
}

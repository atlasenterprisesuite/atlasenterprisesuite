/** Original ATLAS curriculum metadata; not an authorization or credential authority. */
export interface AiModule {
  id: string;
  version: string;
  level: 'foundation' | 'business' | 'engineering';
  title: { en: string; es: string };
  activity: { en: string; es: string };
  prerequisites: readonly string[];
}
export const aiCurriculum: readonly AiModule[] = [
  {
    "id": "foundation",
    "version": "1.0.0",
    "level": "foundation",
    "title": {
      "en": "AI fundamentals",
      "es": "Fundamentos de IA"
    },
    "activity": {
      "en": "Distinguish model outputs from verified facts",
      "es": "Distinguir resultados del modelo de hechos verificados"
    },
    "prerequisites": []
  },
  {
    "id": "prompts",
    "version": "1.0.0",
    "level": "foundation",
    "title": {
      "en": "Prompt engineering",
      "es": "Ingeniería de instrucciones"
    },
    "activity": {
      "en": "Compare prompts using a fixed rubric",
      "es": "Comparar instrucciones con una rúbrica fija"
    },
    "prerequisites": [
      "foundation"
    ]
  },
  {
    "id": "planning",
    "version": "1.0.0",
    "level": "foundation",
    "title": {
      "en": "Strategic planning",
      "es": "Planificación estratégica"
    },
    "activity": {
      "en": "Build a project plan with measurable milestones",
      "es": "Crear un plan con hitos medibles"
    },
    "prerequisites": [
      "prompts"
    ]
  },
  {
    "id": "research",
    "version": "1.0.0",
    "level": "foundation",
    "title": {
      "en": "Research and evidence",
      "es": "Investigación y evidencia"
    },
    "activity": {
      "en": "Verify claims against independent sources",
      "es": "Verificar afirmaciones con fuentes independientes"
    },
    "prerequisites": [
      "planning"
    ]
  },
  {
    "id": "communication",
    "version": "1.0.0",
    "level": "business",
    "title": {
      "en": "Professional communication",
      "es": "Comunicación profesional"
    },
    "activity": {
      "en": "Revise a business memo for clarity and accuracy",
      "es": "Revisar un memorando por claridad y exactitud"
    },
    "prerequisites": [
      "research"
    ]
  },
  {
    "id": "media",
    "version": "1.0.0",
    "level": "business",
    "title": {
      "en": "Original media creation",
      "es": "Creación multimedia original"
    },
    "activity": {
      "en": "Create accessible original educational media",
      "es": "Crear material educativo original y accesible"
    },
    "prerequisites": [
      "communication"
    ]
  },
  {
    "id": "data",
    "version": "1.0.0",
    "level": "business",
    "title": {
      "en": "Data intelligence",
      "es": "Inteligencia de datos"
    },
    "activity": {
      "en": "Validate a synthetic dataset and calculate KPIs",
      "es": "Validar datos sintéticos y calcular indicadores"
    },
    "prerequisites": [
      "media"
    ]
  },
  {
    "id": "finance",
    "version": "1.0.0",
    "level": "business",
    "title": {
      "en": "Finance and accounting AI",
      "es": "IA financiera y contable"
    },
    "activity": {
      "en": "Reconcile synthetic ledger entries",
      "es": "Conciliar registros contables sintéticos"
    },
    "prerequisites": [
      "data"
    ]
  },
  {
    "id": "apps",
    "version": "1.0.0",
    "level": "engineering",
    "title": {
      "en": "AI application engineering",
      "es": "Ingeniería de aplicaciones IA"
    },
    "activity": {
      "en": "Build and test a small accessible application",
      "es": "Construir y probar una aplicación accesible"
    },
    "prerequisites": [
      "finance"
    ]
  },
  {
    "id": "agents",
    "version": "1.0.0",
    "level": "engineering",
    "title": {
      "en": "Supervised agents",
      "es": "Agentes supervisados"
    },
    "activity": {
      "en": "Design an approval gate for simulated actions",
      "es": "Diseñar un control de aprobación para acciones simuladas"
    },
    "prerequisites": [
      "apps"
    ]
  },
  {
    "id": "security",
    "version": "1.0.0",
    "level": "engineering",
    "title": {
      "en": "Security and governance",
      "es": "Seguridad y gobernanza"
    },
    "activity": {
      "en": "Test access controls using synthetic accounts",
      "es": "Probar controles de acceso con cuentas sintéticas"
    },
    "prerequisites": [
      "agents"
    ]
  },
  {
    "id": "capstone",
    "version": "1.0.0",
    "level": "engineering",
    "title": {
      "en": "Professional capstone",
      "es": "Proyecto profesional"
    },
    "activity": {
      "en": "Deliver a tested project with evidence and limitations",
      "es": "Entregar un proyecto probado con evidencia y limitaciones"
    },
    "prerequisites": [
      "security"
    ]
  }
];

export function validateAiCurriculum(input: unknown): asserts input is readonly AiModule[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 1000) throw new Error('Invalid catalog');
  const modules = new Map<string, AiModule>();
  const bilingual = (v: unknown): boolean => {
    if (!v || typeof v !== 'object') return false;
    const t = v as Record<string, unknown>;
    return typeof t.en === 'string' && !!t.en.trim() && typeof t.es === 'string' && !!t.es.trim();
  };
  for (const m of input) {
    if (!m || typeof m.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(m.id) ||
        modules.has(m.id) || typeof m.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(m.version) ||
        !['foundation','business','engineering'].includes(m.level) ||
        !bilingual(m.title) || !bilingual(m.activity) || !Array.isArray(m.prerequisites) ||
        m.prerequisites.some((p: unknown) => typeof p !== 'string') ||
        new Set(m.prerequisites).size !== m.prerequisites.length) throw new Error('Invalid module');
    modules.set(m.id, m);
  }
  const active = new Set<string>();
  const done = new Set<string>();
  function visit(id: string): void {
    if (active.has(id)) throw new Error('Cyclic prerequisite');
    if (done.has(id)) return;
    const m = modules.get(id);
    if (!m) throw new Error('Unknown prerequisite');
    active.add(id);
    for (const p of m.prerequisites) visit(p);
    active.delete(id);
    done.add(id);
  }
  for (const id of modules.keys()) visit(id);
}

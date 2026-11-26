import { aiCurriculum } from './aiCurriculum';
type Locale = 'en' | 'es';
type Bilingual = Readonly<Record<Locale, string>>;
type Lesson = { id: string; title: Bilingual; explanation: Bilingual; exercise: Bilingual };
const lessons: Readonly<Record<string, readonly Lesson[]>> = {
  "foundation": [
    {
      "id": "foundation-1",
      "title": {
        "en": "Model outputs",
        "es": "Resultados del modelo"
      },
      "explanation": {
        "en": "A language model predicts plausible text; plausibility is not verification.",
        "es": "Un modelo de lenguaje predice texto plausible; la plausibilidad no equivale a verificación."
      },
      "exercise": {
        "en": "Ask for three claims about a fictional shop and mark which need evidence.",
        "es": "Solicita tres afirmaciones sobre una tienda ficticia y marca cuáles requieren evidencia."
      }
    },
    {
      "id": "foundation-2",
      "title": {
        "en": "Privacy",
        "es": "Privacidad"
      },
      "explanation": {
        "en": "Use synthetic inputs and remove identifiers before sharing data.",
        "es": "Usa entradas sintéticas y elimina identificadores antes de compartir datos."
      },
      "exercise": {
        "en": "Replace names and account numbers in a fictional invoice.",
        "es": "Sustituye nombres y números de cuenta en una factura ficticia."
      }
    }
  ],
  "prompts": [
    {
      "id": "prompts-1",
      "title": {
        "en": "Task specification",
        "es": "Especificación"
      },
      "explanation": {
        "en": "State the goal, context, constraints and expected output.",
        "es": "Define objetivo, contexto, restricciones y resultado esperado."
      },
      "exercise": {
        "en": "Write two prompts for the same fictional report.",
        "es": "Escribe dos instrucciones para el mismo informe ficticio."
      }
    },
    {
      "id": "prompts-2",
      "title": {
        "en": "Evaluation",
        "es": "Evaluación"
      },
      "explanation": {
        "en": "Compare outputs against a fixed rubric rather than fluency.",
        "es": "Compara resultados con una rúbrica fija, no solo fluidez."
      },
      "exercise": {
        "en": "Score both outputs for accuracy and completeness.",
        "es": "Califica ambos resultados por exactitud e integridad."
      }
    }
  ],
  "planning": [
    {
      "id": "planning-1",
      "title": {
        "en": "Milestones",
        "es": "Hitos"
      },
      "explanation": {
        "en": "Break a goal into measurable deliverables and dependencies.",
        "es": "Divide un objetivo en entregables medibles y dependencias."
      },
      "exercise": {
        "en": "Plan a fictional school event in four milestones.",
        "es": "Planifica un evento escolar ficticio en cuatro hitos."
      }
    },
    {
      "id": "planning-2",
      "title": {
        "en": "Risk",
        "es": "Riesgo"
      },
      "explanation": {
        "en": "Record assumptions, owners and fallback options.",
        "es": "Registra supuestos, responsables y alternativas."
      },
      "exercise": {
        "en": "Identify three risks and a mitigation for each.",
        "es": "Identifica tres riesgos y una mitigación por cada uno."
      }
    }
  ],
  "research": [
    {
      "id": "research-1",
      "title": {
        "en": "Source quality",
        "es": "Calidad de fuentes"
      },
      "explanation": {
        "en": "Distinguish primary evidence from commentary and check dates.",
        "es": "Distingue evidencia primaria de comentarios y comprueba fechas."
      },
      "exercise": {
        "en": "Compare two public sources on a scientific topic.",
        "es": "Compara dos fuentes públicas sobre un tema científico."
      }
    },
    {
      "id": "research-2",
      "title": {
        "en": "Claim ledger",
        "es": "Registro de afirmaciones"
      },
      "explanation": {
        "en": "Record each claim, supporting evidence and uncertainty.",
        "es": "Registra cada afirmación, evidencia e incertidumbre."
      },
      "exercise": {
        "en": "Build a three-row claim ledger.",
        "es": "Construye un registro de tres afirmaciones."
      }
    }
  ],
  "communication": [
    {
      "id": "communication-1",
      "title": {
        "en": "Audience",
        "es": "Audiencia"
      },
      "explanation": {
        "en": "Match tone and structure to the reader and intended decision.",
        "es": "Adapta tono y estructura al lector y decisión prevista."
      },
      "exercise": {
        "en": "Draft a fictional project update for two audiences.",
        "es": "Redacta una actualización ficticia para dos audiencias."
      }
    },
    {
      "id": "communication-2",
      "title": {
        "en": "Review",
        "es": "Revisión"
      },
      "explanation": {
        "en": "Check facts, commitments and private information before sending.",
        "es": "Verifica hechos, compromisos y datos privados antes de enviar."
      },
      "exercise": {
        "en": "Revise the update using a checklist.",
        "es": "Revisa la actualización con una lista de control."
      }
    }
  ],
  "media": [
    {
      "id": "media-1",
      "title": {
        "en": "Originality",
        "es": "Originalidad"
      },
      "explanation": {
        "en": "Create original assets and track rights and attribution.",
        "es": "Crea recursos originales y registra derechos y atribución."
      },
      "exercise": {
        "en": "Storyboard an original educational explainer.",
        "es": "Diseña un guion gráfico educativo original."
      }
    },
    {
      "id": "media-2",
      "title": {
        "en": "Accessibility",
        "es": "Accesibilidad"
      },
      "explanation": {
        "en": "Use readable contrast, captions and descriptive alternatives.",
        "es": "Usa contraste legible, subtítulos y alternativas descriptivas."
      },
      "exercise": {
        "en": "Add captions and alternative text to the storyboard.",
        "es": "Añade subtítulos y texto alternativo al guion gráfico."
      }
    }
  ],
  "data": [
    {
      "id": "data-1",
      "title": {
        "en": "Data quality",
        "es": "Calidad de datos"
      },
      "explanation": {
        "en": "Check missing values, duplicates and units before analysis.",
        "es": "Comprueba valores faltantes, duplicados y unidades antes del análisis."
      },
      "exercise": {
        "en": "Clean a synthetic table with ten rows.",
        "es": "Limpia una tabla sintética de diez filas."
      }
    },
    {
      "id": "data-2",
      "title": {
        "en": "Metrics",
        "es": "Indicadores"
      },
      "explanation": {
        "en": "Define numerator, denominator and measurement period.",
        "es": "Define numerador, denominador y período de medición."
      },
      "exercise": {
        "en": "Calculate a completion rate and explain its limitations.",
        "es": "Calcula una tasa de finalización y explica sus límites."
      }
    }
  ],
  "finance": [
    {
      "id": "finance-1",
      "title": {
        "en": "Reconciliation",
        "es": "Conciliación"
      },
      "explanation": {
        "en": "Compare independent records and investigate differences.",
        "es": "Compara registros independientes e investiga diferencias."
      },
      "exercise": {
        "en": "Reconcile a fictional ledger against a fictional statement.",
        "es": "Concilia un libro contable ficticio con un estado ficticio."
      }
    },
    {
      "id": "finance-2",
      "title": {
        "en": "Review controls",
        "es": "Controles de revisión"
      },
      "explanation": {
        "en": "Keep supporting evidence and require review of adjustments.",
        "es": "Conserva evidencia y exige revisión de ajustes."
      },
      "exercise": {
        "en": "Document two discrepancies without inventing transactions.",
        "es": "Documenta dos diferencias sin inventar transacciones."
      }
    }
  ],
  "apps": [
    {
      "id": "apps-1",
      "title": {
        "en": "Contracts",
        "es": "Contratos"
      },
      "explanation": {
        "en": "Define inputs, outputs and invalid cases before implementing.",
        "es": "Define entradas, salidas y casos inválidos antes de implementar."
      },
      "exercise": {
        "en": "Specify a fictional task-list function.",
        "es": "Especifica una función ficticia de lista de tareas."
      }
    },
    {
      "id": "apps-2",
      "title": {
        "en": "Tests",
        "es": "Pruebas"
      },
      "explanation": {
        "en": "Test normal, boundary and invalid inputs.",
        "es": "Prueba entradas normales, límite e inválidas."
      },
      "exercise": {
        "en": "Write three tests for the task-list function.",
        "es": "Escribe tres pruebas para la función."
      }
    }
  ],
  "agents": [
    {
      "id": "agents-1",
      "title": {
        "en": "Boundaries",
        "es": "Límites"
      },
      "explanation": {
        "en": "Separate proposals from external actions and require appropriate approval.",
        "es": "Separa propuestas de acciones externas y exige aprobación apropiada."
      },
      "exercise": {
        "en": "Design an agent that drafts but does not send messages.",
        "es": "Diseña un agente que redacte mensajes sin enviarlos."
      }
    },
    {
      "id": "agents-2",
      "title": {
        "en": "Recovery",
        "es": "Recuperación"
      },
      "explanation": {
        "en": "Use bounded retries and idempotency to prevent duplicate effects.",
        "es": "Usa reintentos limitados e idempotencia para evitar efectos duplicados."
      },
      "exercise": {
        "en": "Simulate a failed fictional task and safe retry.",
        "es": "Simula una tarea ficticia fallida y un reintento seguro."
      }
    }
  ],
  "security": [
    {
      "id": "security-1",
      "title": {
        "en": "Least privilege",
        "es": "Privilegio mínimo"
      },
      "explanation": {
        "en": "Grant only necessary permissions and deny access by default.",
        "es": "Concede solo permisos necesarios y deniega acceso por defecto."
      },
      "exercise": {
        "en": "Design roles for a fictional learning app.",
        "es": "Diseña roles para una aplicación educativa ficticia."
      }
    },
    {
      "id": "security-2",
      "title": {
        "en": "Trust boundaries",
        "es": "Límites de confianza"
      },
      "explanation": {
        "en": "Treat retrieved text as data, not as privileged instructions.",
        "es": "Trata texto recuperado como datos, no instrucciones privilegiadas."
      },
      "exercise": {
        "en": "Identify untrusted instructions in a synthetic document.",
        "es": "Identifica instrucciones no confiables en un documento sintético."
      }
    }
  ],
  "capstone": [
    {
      "id": "capstone-1",
      "title": {
        "en": "Acceptance",
        "es": "Aceptación"
      },
      "explanation": {
        "en": "Define success with observable tests and documented limitations.",
        "es": "Define éxito con pruebas observables y limitaciones documentadas."
      },
      "exercise": {
        "en": "Build a small original learning tool using synthetic data.",
        "es": "Construye una herramienta educativa original con datos sintéticos."
      }
    },
    {
      "id": "capstone-2",
      "title": {
        "en": "Evidence",
        "es": "Evidencia"
      },
      "explanation": {
        "en": "Record test results, versions and unresolved issues.",
        "es": "Registra resultados de pruebas, versiones y problemas pendientes."
      },
      "exercise": {
        "en": "Prepare a release report that distinguishes verified and pending work.",
        "es": "Prepara un informe que distinga trabajo verificado y pendiente."
      }
    }
  ]
};
/** Original public educational content only; does not grant enrollment, completion or credentials. */
export function getAiLessons(moduleId: string, version: string, locale: string) {
  if (locale !== 'en' && locale !== 'es') throw new Error('Unsupported locale');
  const module = aiCurriculum.find(m => m.id === moduleId && m.version === version);
  if (!module || !Object.prototype.hasOwnProperty.call(lessons, moduleId)) throw new Error('Unknown module version');
  const language: Locale = locale;
  return lessons[moduleId].map(l => ({id:l.id,title:l.title[language],explanation:l.explanation[language],exercise:l.exercise[language]}));
}

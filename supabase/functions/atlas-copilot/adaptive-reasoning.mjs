// ATLAS Intelligence: deterministic, provider-neutral effort hint.
// This is NOT authorization, a risk assessment, or permission to spend.
const HIGH_ASSURANCE_SIGNALS = /(?:\b(?:p0|777\s+review|rbac|rls|tdd|exact[\s-]?sha|tenant|multi[\s-]?tenant|fail[\s-]?closed|zero[\s-]?trust|security|seguridad|revocaci[oó]n|privilege\s+escalation|vulnerabilit(?:y|ies)|vulnerabilidad|penetration\s+test|production\s+deploy|despliegue\s+producci[oó]n)\b|\b(?:audit(?:ar|a|or|ing)?|auditor[ií]a|architecture|arquitectura|migration|migraci[oó]n)\b)/i;
const MULTISTEP_SIGNALS = /\b(?:implement(?:a|ar|ation)?|desarroll(?:a|ar|o)|refactor(?:iza|ing)?|probar|testing|pruebas|reconciliaci[oó]n|investigaci[oó]n|investiga|debug|diagnostic(?:ar|a)?|investigate|research)\b/i;
const ANALYTICAL_SIGNALS = /\b(?:analiz(?:a|ar|e)|analysis|analyze|compare|compara|explica|explain|resume|summarize|resumen|planifica|planning|propuesta|proposal|eval[uú]a)\b/i;

export function selectAdaptiveReasoningProfile(input = {}) {
  // Do not use untrusted caller-provided criticality, actor roles, org IDs,
  // entitlement or budget values to decide effort.
  const message = typeof input.message === 'string' ? input.message.trim().slice(0, 12000) : '';
  if (HIGH_ASSURANCE_SIGNALS.test(message)) {
    return Object.freeze({ profile: 'deep', reason: 'high_assurance_work' });
  }
  if (message.length >= 700 || (message.length >= 230 && MULTISTEP_SIGNALS.test(message))) {
    return Object.freeze({ profile: 'deep', reason: 'complex_multistep_request' });
  }
  if (message.length >= 100 || MULTISTEP_SIGNALS.test(message) || ANALYTICAL_SIGNALS.test(message)) {
    return Object.freeze({ profile: 'balanced', reason: 'analysis_required' });
  }
  return Object.freeze({ profile: 'fast', reason: 'simple_request' });
}

/**
 * Context is accepted only from the authenticated conversation store, not from
 * request.client_metadata or caller-supplied history. A short follow-up can
 * inherit the established effort floor. No text is returned or logged.
 */
export function selectConversationReasoningProfile({ message, history = [] } = {}) {
  const current = selectAdaptiveReasoningProfile({ message });
  if (current.profile === 'deep' || !Array.isArray(history) || history.length === 0) return current;
  const currentText = typeof message === 'string' ? message.trim() : '';
  if (currentText.length > 120) return current;
  const recent = history.slice(-12).filter(item => item && item.role === 'user' && typeof item.content === 'string');
  const prior = recent.slice(-4).map(item => selectAdaptiveReasoningProfile({ message: item.content }));
  if (prior.some(result => result.profile === 'deep')) {
    return Object.freeze({ profile: 'deep', reason: 'authorized_conversation_continuity' });
  }
  if (current.profile === 'fast' && prior.some(result => result.profile === 'balanced')) {
    return Object.freeze({ profile: 'balanced', reason: 'authorized_conversation_continuity' });
  }
  return current;
}

/** ATLAS Universal Setup 777: pure, side-effect-free onboarding policy. */
export type SetupLanguage = 'es' | 'en';
export type SetupStepId = 'welcome' | 'language' | 'accessibility' | 'identity' | 'device' | 'migration' | 'security' | 'assistant';
export type SetupGate = Readonly<{
  identityVerified: boolean;
  tenantVerified: boolean;
  consentGranted: boolean;
  adapterAuthorized: boolean;
}>;
const steps: ReadonlyArray<readonly [SetupStepId, string, string]> = [
  ['welcome', 'Bienvenido a ATLAS', 'Welcome to ATLAS'],
  ['language', 'Idioma', 'Language'],
  ['accessibility', 'Accesibilidad', 'Accessibility'],
  ['identity', 'Identidad segura', 'Secure identity'],
  ['device', 'Vincular dispositivo', 'Link device'],
  ['migration', 'Migración autorizada', 'Authorized migration'],
  ['security', 'Seguridad y privacidad', 'Security and privacy'],
  ['assistant', 'ATLAS AI', 'ATLAS AI']
];
export function getSetupSteps(language: SetupLanguage) {
  if (language !== 'es' && language !== 'en') throw new Error('Unsupported setup language');
  return steps.map(([id, es, en]) => ({ id, title: language === 'es' ? es : en }));
}
export function evaluateSetupGate(gate: SetupGate): { allowed: boolean; blockers: string[] } {
  const blockers = (['identityVerified','tenantVerified','consentGranted','adapterAuthorized'] as const)
    .filter(key => gate[key] !== true);
  return { allowed: blockers.length === 0, blockers };
}

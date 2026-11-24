import type { SetupLanguage } from './universalSetupModel';
export type SetupDraft = { language: SetupLanguage; step: number; captions: boolean };
export const DEFAULT_SETUP_DRAFT: SetupDraft = { language: 'en', step: 0, captions: false };
export function parseSetupDraft(value: string | null): SetupDraft | null {
  if (!value || value.length > 1024) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const p = parsed as Record<string, unknown>;
    if ((p.language !== 'en' && p.language !== 'es') ||
        !Number.isInteger(p.step) || (p.step as number) < 0 || (p.step as number) > 7 ||
        typeof p.captions !== 'boolean') return null;
    return { language: p.language, step: p.step as number, captions: p.captions };
  } catch { return null; }
}
export function serializeSetupDraft(value: SetupDraft): string {
  const safe = parseSetupDraft(JSON.stringify({
    language: value.language, step: value.step, captions: value.captions
  }));
  if (!safe) throw new Error('Invalid setup draft');
  return JSON.stringify(safe);
}

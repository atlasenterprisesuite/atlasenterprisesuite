export type DubbingSegment = { id: string; startMs: number; endMs: number; speakerId: string; sourceText: string; translatedText: string };
export type DubbingProject = { id: string; title: string; sourceLanguage: string; targetLanguage: string; segments: DubbingSegment[]; consentVerified: boolean };
export function validateDubbingProject(project: DubbingProject): string[] {
  const errors: string[] = [];
  if (!project.id.trim()) errors.push('project_id_required');
  if (!project.sourceLanguage.trim() || !project.targetLanguage.trim()) errors.push('languages_required');
  const ids = new Set<string>();
  for (const s of project.segments) {
    if (!s.id.trim() || ids.has(s.id)) errors.push('invalid_or_duplicate_segment_id');
    ids.add(s.id);
    if (!Number.isFinite(s.startMs) || !Number.isFinite(s.endMs) || s.startMs < 0 || s.endMs <= s.startMs) errors.push('invalid_timing');
    if (!s.speakerId.trim()) errors.push('speaker_required');
  }
  return errors;
}
function timestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const h = Math.floor(total / 3600000);
  const m = Math.floor(total / 60000) % 60;
  const s = Math.floor(total / 1000) % 60;
  return [h,m,s].map(n => String(n).padStart(2,'0')).join(':') + ',' + String(total % 1000).padStart(3,'0');
}
export function exportDubbingSrt(project: DubbingProject): string {
  const errors = validateDubbingProject(project);
  if (errors.length) throw new Error(errors.join(','));
  return [...project.segments].sort((a,b) => a.startMs-b.startMs).map((s,i) =>
    String(i+1)+'\n'+timestamp(s.startMs)+' --> '+timestamp(s.endMs)+'\n'+(s.translatedText || s.sourceText).replace(/\r/g,'')+'\n'
  ).join('\n');
}
export function canCloneDubbingVoice(project: DubbingProject): boolean { return project.consentVerified === true; }

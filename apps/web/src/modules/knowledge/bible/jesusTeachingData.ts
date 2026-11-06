import type { BibleEvidenceState } from './bibleOsData';

export type JesusTeachingSeed = {
  id: string;
  title: string;
  passage: string;
  theme: 'love' | 'mercy' | 'service' | 'peace' | 'stewardship';
  evidenceState: BibleEvidenceState;
  sourceId: string;
  summary: string;
  status: 'curated_seed';
};

export const JESUS_TEACHING_SEEDS: readonly JesusTeachingSeed[] = [
  { id: 'neighbor-love', title: 'Love your neighbor', passage: 'Mark 12:28–34', theme: 'love', evidenceState: 'THEOLOGICAL_CLAIM', sourceId: 'intf', summary: 'Gospel teaching on love of God and neighbor; theological meaning is distinct from manuscript attestation.', status: 'curated_seed' },
  { id: 'good-samaritan', title: 'The Good Samaritan', passage: 'Luke 10:25–37', theme: 'mercy', evidenceState: 'THEOLOGICAL_CLAIM', sourceId: 'intf', summary: 'Parable used to discuss mercy across social boundaries.', status: 'curated_seed' },
  { id: 'servant-leadership', title: 'Service rather than domination', passage: 'Mark 10:42–45', theme: 'service', evidenceState: 'THEOLOGICAL_CLAIM', sourceId: 'intf', summary: 'Teaching about leadership expressed through service.', status: 'curated_seed' },
  { id: 'peacemakers', title: 'Blessed are the peacemakers', passage: 'Matthew 5:9', theme: 'peace', evidenceState: 'THEOLOGICAL_CLAIM', sourceId: 'intf', summary: 'Beatitude on peacemaking; no claim of scientific proof.', status: 'curated_seed' },
  { id: 'faithful-stewardship', title: 'Faithfulness in small matters', passage: 'Luke 16:10', theme: 'stewardship', evidenceState: 'THEOLOGICAL_CLAIM', sourceId: 'intf', summary: 'Teaching relevant to responsible stewardship, not a substitute for professional financial advice.', status: 'curated_seed' }
] as const;

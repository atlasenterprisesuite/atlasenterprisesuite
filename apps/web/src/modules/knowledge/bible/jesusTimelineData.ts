import type { BibleEvidenceState } from './bibleOsData';

export type JesusTimelineSeed = {
  id: string;
  order: number;
  periodLabel: string;
  title: string;
  passage: string;
  summary: string;
  sourceId: 'intf';
  evidenceState: BibleEvidenceState;
  status: 'curated_seed';
};

export const JESUS_TIMELINE_SEEDS: readonly JesusTimelineSeed[] = [
  { id: 'birth-narratives', order: 1, periodLabel: 'Birth narratives', title: 'Birth of Jesus', passage: 'Matthew 1–2; Luke 1–2', summary: 'The Gospels of Matthew and Luke narrate Jesus’s birth; chronology and narrative details require separate historical assessment.', sourceId: 'intf', evidenceState: 'THEOLOGICAL_CLAIM', status: 'curated_seed' },
  { id: 'baptism', order: 2, periodLabel: 'Beginning of public ministry', title: 'Baptism of Jesus', passage: 'Mark 1:9–11', summary: 'The Gospel of Mark recounts Jesus’s baptism by John.', sourceId: 'intf', evidenceState: 'THEOLOGICAL_CLAIM', status: 'curated_seed' },
  { id: 'ministry', order: 3, periodLabel: 'Public ministry', title: 'Teaching and healing narratives', passage: 'Mark 1–10', summary: 'Gospel accounts present teachings, parables, healings and encounters; this is a thematic grouping, not a precise dated sequence.', sourceId: 'intf', evidenceState: 'THEOLOGICAL_CLAIM', status: 'curated_seed' },
  { id: 'jerusalem', order: 4, periodLabel: 'Jerusalem narratives', title: 'Entry into Jerusalem', passage: 'Mark 11:1–11', summary: 'Mark narrates Jesus entering Jerusalem near the final phase of his ministry.', sourceId: 'intf', evidenceState: 'THEOLOGICAL_CLAIM', status: 'curated_seed' },
  { id: 'crucifixion', order: 5, periodLabel: 'Passion narratives', title: 'Crucifixion', passage: 'Mark 15', summary: 'The crucifixion is described in the Gospels; theological interpretation and historical corroboration should be separately assessed.', sourceId: 'intf', evidenceState: 'THEOLOGICAL_CLAIM', status: 'curated_seed' },
  { id: 'resurrection', order: 6, periodLabel: 'Resurrection narratives', title: 'Resurrection proclamation', passage: 'Mark 16; Luke 24', summary: 'The Gospels preserve resurrection narratives. Mark 16 has significant manuscript variation, and resurrection claims must be labeled as theological.', sourceId: 'intf', evidenceState: 'THEOLOGICAL_CLAIM', status: 'curated_seed' }
] as const;

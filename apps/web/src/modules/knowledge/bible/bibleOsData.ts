export type BibleEvidenceState =
  | 'DIRECT_WITNESS'
  | 'CRITICAL_RECONSTRUCTION'
  | 'HISTORICALLY_ATTESTED'
  | 'SCHOLARLY_CONSENSUS'
  | 'MAJORITY_VIEW'
  | 'MINORITY_VIEW'
  | 'TRADITIONAL_CLAIM'
  | 'THEOLOGICAL_CLAIM'
  | 'DISPUTED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'UNKNOWN';

export type BibleSeedStatus = 'curated_seed';

export type BibleSource = {
  id: string;
  title: string;
  institution: string;
  url: string;
  scope: string;
  status: BibleSeedStatus;
};

export type CanonProfile = {
  id: string;
  label: string;
  family: string;
  note: string;
  evidenceState: BibleEvidenceState;
  status: BibleSeedStatus;
};

export type ManuscriptSeed = {
  id: string;
  name: string;
  dateLabel: string;
  language: string;
  scope: string;
  sourceId: string;
  evidenceState: BibleEvidenceState;
  confidence: 'high' | 'medium' | 'low';
  status: BibleSeedStatus;
};

export type VariantSeed = {
  id: string;
  passage: string;
  issue: string;
  assessment: string;
  sourceIds: string[];
  evidenceState: BibleEvidenceState;
  confidence: 'high' | 'medium' | 'low';
  status: BibleSeedStatus;
};

export type RelationshipSeed = {
  id: string;
  from: string;
  relation: 'ATTESTED_BY' | 'CATALOGED_BY' | 'VARIANT_OF' | 'INCLUDES' | 'EXCLUDES';
  to: string;
  sourceIds: string[];
  evidenceState: BibleEvidenceState;
  confidence: 'high' | 'medium' | 'low';
  status: BibleSeedStatus;
};

export const BIBLE_OS_SOURCES: readonly BibleSource[] = [
  {
    id: 'intf',
    title: 'Institute for New Testament Textual Research',
    institution: 'University of Münster',
    url: 'https://www.uni-muenster.de/INTF/en/',
    scope: 'Greek New Testament manuscript tradition, textual criticism and critical-text research.',
    status: 'curated_seed'
  },
  {
    id: 'sinaiticus',
    title: 'Codex Sinaiticus Project',
    institution: 'International Codex Sinaiticus Project partners',
    url: 'https://www.codexsinaiticus.org/',
    scope: 'Digitized manuscript images, transcription and manuscript history for Codex Sinaiticus.',
    status: 'curated_seed'
  },
  {
    id: 'dss',
    title: 'Leon Levy Dead Sea Scrolls Digital Library',
    institution: 'Israel Antiquities Authority',
    url: 'https://www.deadseascrolls.org.il/',
    scope: 'Digitized Dead Sea Scrolls material and collection metadata.',
    status: 'curated_seed'
  }
] as const;

export const BIBLE_OS_CANON_PROFILES: readonly CanonProfile[] = [
  {
    id: 'tanakh',
    label: 'Jewish / Tanakh',
    family: 'Jewish scripture tradition',
    note: 'Modeled as a distinct canon profile. Book ordering, grouping and naming are not forced into a Christian counting scheme.',
    evidenceState: 'HISTORICALLY_ATTESTED',
    status: 'curated_seed'
  },
  {
    id: 'protestant',
    label: 'Protestant',
    family: 'Western Christian canon profile',
    note: 'Represented as one tradition profile for comparison, not as the universal definition of the Bible.',
    evidenceState: 'HISTORICALLY_ATTESTED',
    status: 'curated_seed'
  },
  {
    id: 'catholic',
    label: 'Catholic',
    family: 'Western Christian canon profile',
    note: 'Preserves deuterocanonical distinctions and longer forms where the source tradition requires them.',
    evidenceState: 'HISTORICALLY_ATTESTED',
    status: 'curated_seed'
  },
  {
    id: 'greek-orthodox',
    label: 'Greek Orthodox',
    family: 'Eastern Christian canon profile',
    note: 'Maintained independently so ordering, naming and inclusion differences remain inspectable.',
    evidenceState: 'HISTORICALLY_ATTESTED',
    status: 'curated_seed'
  },
  {
    id: 'ethiopian-orthodox',
    label: 'Ethiopian Orthodox Tewahedo',
    family: 'Oriental Orthodox canon profile',
    note: 'Maintained as its own profile; detailed work-level mapping remains source-by-source research rather than an assumed count.',
    evidenceState: 'HISTORICALLY_ATTESTED',
    status: 'curated_seed'
  }
] as const;

export const BIBLE_OS_MANUSCRIPTS: readonly ManuscriptSeed[] = [
  {
    id: 'codex-sinaiticus',
    name: 'Codex Sinaiticus',
    dateLabel: '4th century CE',
    language: 'Greek',
    scope: 'Major biblical manuscript witness; the project preserves manuscript images, transcription and documented corrections.',
    sourceId: 'sinaiticus',
    evidenceState: 'DIRECT_WITNESS',
    confidence: 'high',
    status: 'curated_seed'
  },
  {
    id: 'dead-sea-scrolls-collection',
    name: 'Dead Sea Scrolls / Judean Desert biblical manuscripts',
    dateLabel: 'Approx. 3rd century BCE–1st century CE across the collection',
    language: 'Primarily Hebrew, with Aramaic and Greek represented in the wider collection',
    scope: 'Collection-level seed for pre-medieval textual witnesses. Individual fragments must be modeled separately before passage-level conclusions.',
    sourceId: 'dss',
    evidenceState: 'DIRECT_WITNESS',
    confidence: 'high',
    status: 'curated_seed'
  }
] as const;

export const BIBLE_OS_VARIANTS: readonly VariantSeed[] = [
  {
    id: 'mark-long-ending',
    passage: 'Mark 16:9–20',
    issue: 'The ending of Mark is a well-known textual-variation unit whose manuscript attestation is not uniform.',
    assessment: 'Bible OS must display competing manuscript evidence and editorial judgments rather than label one modern wording as an extant autograph.',
    sourceIds: ['intf', 'sinaiticus'],
    evidenceState: 'DISPUTED',
    confidence: 'high',
    status: 'curated_seed'
  },
  {
    id: 'john-pericope-adulterae',
    passage: 'John 7:53–8:11',
    issue: 'The passage has a complex transmission history across manuscript witnesses and locations.',
    assessment: 'The P0 records only the existence of a significant variation unit. Detailed witness-by-witness reconstruction remains future corpus work.',
    sourceIds: ['intf', 'sinaiticus'],
    evidenceState: 'DISPUTED',
    confidence: 'high',
    status: 'curated_seed'
  }
] as const;

export const BIBLE_OS_RELATIONSHIPS: readonly RelationshipSeed[] = [
  {
    id: 'sinaiticus-attested-by-project',
    from: 'Codex Sinaiticus',
    relation: 'ATTESTED_BY',
    to: 'Codex Sinaiticus Project',
    sourceIds: ['sinaiticus'],
    evidenceState: 'DIRECT_WITNESS',
    confidence: 'high',
    status: 'curated_seed'
  },
  {
    id: 'dss-cataloged-by-iaa',
    from: 'Dead Sea Scrolls / Judean Desert biblical manuscripts',
    relation: 'CATALOGED_BY',
    to: 'Leon Levy Dead Sea Scrolls Digital Library',
    sourceIds: ['dss'],
    evidenceState: 'DIRECT_WITNESS',
    confidence: 'high',
    status: 'curated_seed'
  },
  {
    id: 'mark-ending-variant',
    from: 'Mark 16 ending readings',
    relation: 'VARIANT_OF',
    to: 'Mark 16 transmission unit',
    sourceIds: ['intf', 'sinaiticus'],
    evidenceState: 'DISPUTED',
    confidence: 'high',
    status: 'curated_seed'
  }
] as const;

export const BIBLE_OS_LIMITATIONS = [
  'This is curated seed evidence, not a complete manuscript corpus.',
  'A critical reconstruction is an evidence-based scholarly reconstruction, not an extant autograph.',
  'Canon profiles are compared without declaring one tradition universally authoritative.',
  'Theological claims, historical claims and textual-critical conclusions remain separate evidence classes.',
  'Passage-level conclusions require attributable witness data before they may be marked verified.'
] as const;

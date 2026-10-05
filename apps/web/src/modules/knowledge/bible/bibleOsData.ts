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
  sourceIds: string[];
  evidenceState: BibleEvidenceState;
  status: BibleSeedStatus;
};

export type ManuscriptSeed = {
  id: string;
  name: string;
  catalogIdentifiers: string[];
  dateLabel: string;
  language: string;
  material: string;
  script: string;
  repository: string;
  provenanceHistory: string;
  digitizationUrl: string;
  transcriptionSource: string;
  preservedPassages: string;
  lacunae: string;
  corrections: string;
  bibliography: string[];
  rightsLicense: string;
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

export type BibleRelationshipType =
  | 'QUOTES'
  | 'ALLUDES_TO'
  | 'PARALLEL_TO'
  | 'FULFILLS'
  | 'REFERENCES'
  | 'SHARES_PERSON'
  | 'SHARES_PLACE'
  | 'SHARES_EVENT'
  | 'SHARES_THEME'
  | 'MANUSCRIPT_VARIANT_OF'
  | 'TRANSLATION_OF'
  | 'COPIED_FROM_OR_RELATED_TO'
  | 'CANON_INCLUDES'
  | 'CANON_EXCLUDES'
  | 'CORRECTED_BY'
  | 'ATTESTED_BY'
  | 'DISPUTED_BY'
  | 'SUPPORTED_BY'
  | 'CONTRADICTS'
  | 'DATED_BEFORE'
  | 'DATED_AFTER';

export type RelationshipSeed = {
  id: string;
  from: string;
  relation: BibleRelationshipType;
  to: string;
  sourceIds: string[];
  relationMethod: string;
  creatorImporter: string;
  createdAt: string;
  verifiedAt: string;
  verificationStatus: 'verified' | 'probable' | 'possible' | 'disputed' | 'unverified';
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
  },
  {
    id: 'canon-formation-reference',
    title: 'Transmissions and Translations of the Bible',
    institution: 'Society of Biblical Literature',
    url: 'https://www.sbl-site.org/assets/pdfs/TBtexttranslationBB.pdf',
    scope: 'Academic reference for the transmission of biblical texts and differences among historical canon traditions.',
    status: 'curated_seed'
  },
  {
    id: 'sbl-canon-comparison',
    title: 'Opening the Old Testament',
    institution: 'Society of Biblical Literature',
    url: 'https://www.sbl-site.org/wp-content/uploads/2024/11/OpeningTheOldTestament.pdf',
    scope: 'Academic comparison of Jewish and Christian scriptural collections, including Protestant, Catholic, Orthodox and Ethiopic differences.',
    status: 'curated_seed'
  }
] as const;

export const BIBLE_OS_CANON_PROFILES: readonly CanonProfile[] = [
  {
    id: 'tanakh',
    label: 'Jewish / Tanakh',
    family: 'Jewish scripture tradition',
    note: 'Modeled as a distinct canon profile. Book ordering, grouping and naming are not forced into a Christian counting scheme.',
    sourceIds: ['canon-formation-reference', 'sbl-canon-comparison'],
    evidenceState: 'HISTORICALLY_ATTESTED',
    status: 'curated_seed'
  },
  {
    id: 'protestant',
    label: 'Protestant',
    family: 'Western Christian canon profile',
    note: 'Represented as one tradition profile for comparison, not as the universal definition of the Bible.',
    sourceIds: ['canon-formation-reference', 'sbl-canon-comparison'],
    evidenceState: 'HISTORICALLY_ATTESTED',
    status: 'curated_seed'
  },
  {
    id: 'catholic',
    label: 'Catholic',
    family: 'Western Christian canon profile',
    note: 'Preserves deuterocanonical distinctions and longer forms where the source tradition requires them.',
    sourceIds: ['canon-formation-reference', 'sbl-canon-comparison'],
    evidenceState: 'HISTORICALLY_ATTESTED',
    status: 'curated_seed'
  },
  {
    id: 'greek-orthodox',
    label: 'Greek Orthodox',
    family: 'Eastern Christian canon profile',
    note: 'Maintained independently so ordering, naming and inclusion differences remain inspectable.',
    sourceIds: ['canon-formation-reference', 'sbl-canon-comparison'],
    evidenceState: 'HISTORICALLY_ATTESTED',
    status: 'curated_seed'
  },
  {
    id: 'ethiopian-orthodox',
    label: 'Ethiopian Orthodox Tewahedo',
    family: 'Oriental Orthodox canon profile',
    note: 'Maintained as its own profile; detailed work-level mapping remains source-by-source research rather than an assumed count.',
    sourceIds: ['sbl-canon-comparison'],
    evidenceState: 'HISTORICALLY_ATTESTED',
    status: 'curated_seed'
  }
] as const;

export const BIBLE_OS_MANUSCRIPTS: readonly ManuscriptSeed[] = [
  {
    id: 'codex-sinaiticus',
    name: 'Codex Sinaiticus',
    catalogIdentifiers: ['Gregory-Aland א (01)'],
    dateLabel: '4th century CE',
    language: 'Greek',
    material: 'Parchment',
    script: 'Greek majuscule',
    repository: 'Distributed holdings including the British Library, Leipzig University Library, the National Library of Russia and St Catherine’s Monastery.',
    provenanceHistory: 'Surviving leaves are distributed across multiple institutions; the Codex Sinaiticus Project digitally reunites and documents the extant witness.',
    digitizationUrl: 'https://www.codexsinaiticus.org/',
    transcriptionSource: 'https://www.codexsinaiticus.org/en/manuscript.aspx',
    preservedPassages: 'Substantial Greek Old Testament material and the complete New Testament in the surviving codex witness; detailed passage inventory remains source-driven.',
    lacunae: 'Old Testament material is incomplete because many leaves are no longer extant; lacunae must be tracked per leaf and passage during corpus ingestion.',
    corrections: 'Multiple correction layers are documented by the Codex Sinaiticus Project; P0 does not yet import corrector-hand data passage by passage.',
    bibliography: ['https://www.codexsinaiticus.org/', 'https://www.uni-muenster.de/INTF/en/'],
    rightsLicense: 'Metadata-only seed. Images and transcriptions remain subject to the Codex Sinaiticus Project’s applicable terms and rights statements.',
    scope: 'Major biblical manuscript witness with digitized images, transcription and documented corrections.',
    sourceId: 'sinaiticus',
    evidenceState: 'DIRECT_WITNESS',
    confidence: 'high',
    status: 'curated_seed'
  },
  {
    id: 'dead-sea-scrolls-collection',
    name: 'Dead Sea Scrolls / Judean Desert biblical manuscripts',
    catalogIdentifiers: ['Dead Sea Scrolls / Judean Desert manuscripts (collection-level seed)'],
    dateLabel: 'Approx. 3rd century BCE–1st century CE across the collection',
    language: 'Primarily Hebrew, with Aramaic and Greek represented in the wider collection',
    material: 'Primarily parchment and papyrus across the collection',
    script: 'Multiple ancient Hebrew/Aramaic/Greek hands across individual witnesses',
    repository: 'Collection-level record. Individual witnesses and fragments have distinct custodians and identifiers; the digital metadata source is the Israel Antiquities Authority.',
    provenanceHistory: 'Judean Desert manuscript collection discovered in the 20th century; P0 records collection-level provenance only and does not merge distinct fragments into one witness.',
    digitizationUrl: 'https://www.deadseascrolls.org.il/',
    transcriptionSource: 'Not ingested in P0; this record links to the Israel Antiquities Authority digital library as a metadata source.',
    preservedPassages: 'Multiple biblical works are represented across the collection; each manuscript or fragment must be itemized before passage-level conclusions are asserted.',
    lacunae: 'Highly fragmentary and witness-specific; the collection must never be presented as one continuous Bible.',
    corrections: 'Not modeled at collection level; correction evidence requires individual witness-level documentation.',
    bibliography: ['https://www.deadseascrolls.org.il/'],
    rightsLicense: 'Metadata-only seed. Image and reuse rights remain subject to the Israel Antiquities Authority and relevant holding-institution terms.',
    scope: 'Collection-level seed for ancient textual witnesses. Individual fragments must be modeled separately before passage-level conclusions.',
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

const CURATED_AT = '2026-10-04T00:00:00Z';
const CURATOR = 'ATLAS Bible OS P0 curated seed';

export const BIBLE_OS_RELATIONSHIPS: readonly RelationshipSeed[] = [
  {
    id: 'sinaiticus-attested-by-project',
    from: 'Codex Sinaiticus',
    relation: 'ATTESTED_BY',
    to: 'Codex Sinaiticus Project',
    sourceIds: ['sinaiticus'],
    relationMethod: 'Curated institutional-source linkage between the manuscript witness and its digital scholarly project.',
    creatorImporter: CURATOR,
    createdAt: CURATED_AT,
    verifiedAt: CURATED_AT,
    verificationStatus: 'verified',
    evidenceState: 'DIRECT_WITNESS',
    confidence: 'high',
    status: 'curated_seed'
  },
  {
    id: 'dss-attested-by-iaa',
    from: 'Dead Sea Scrolls / Judean Desert biblical manuscripts',
    relation: 'ATTESTED_BY',
    to: 'Leon Levy Dead Sea Scrolls Digital Library',
    sourceIds: ['dss'],
    relationMethod: 'Curated collection-to-institutional-catalog linkage; no fragment-level textual inference is made by this edge.',
    creatorImporter: CURATOR,
    createdAt: CURATED_AT,
    verifiedAt: CURATED_AT,
    verificationStatus: 'verified',
    evidenceState: 'DIRECT_WITNESS',
    confidence: 'high',
    status: 'curated_seed'
  },
  {
    id: 'mark-ending-variant',
    from: 'Mark 16 ending readings',
    relation: 'MANUSCRIPT_VARIANT_OF',
    to: 'Mark 16 transmission unit',
    sourceIds: ['intf', 'sinaiticus'],
    relationMethod: 'Curated textual-variation classification based on institutional textual-critical/manuscript sources; no autograph is asserted.',
    creatorImporter: CURATOR,
    createdAt: CURATED_AT,
    verifiedAt: CURATED_AT,
    verificationStatus: 'verified',
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

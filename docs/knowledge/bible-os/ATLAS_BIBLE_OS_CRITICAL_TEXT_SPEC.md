# ATLAS Bible OS — Critical Text & Relationship Graph Specification

Status: Approved product direction; implementation in progress on feature branch.

## 1. Purpose

ATLAS Bible OS is the evidence-first biblical research surface inside Knowledge Atlas. Its goal is not to declare a hidden "true Bible" by assumption. Its goal is to reconstruct, as transparently as possible, the earliest attainable text and the history of transmission by comparing manuscripts, ancient translations, canonical traditions, textual variants, quotations, historical context, and scholarly evidence.

The product must preserve theological perspectives while keeping them distinguishable from historical and textual-critical claims.

## 2. Core principles

1. Source first: every textual claim must resolve to one or more sources.
2. No invented certainty: disputed readings remain disputed.
3. Canon-neutral storage: Protestant, Catholic, Eastern Orthodox, Oriental Orthodox, Ethiopian, Jewish/Tanakh and historical collections are modeled as profiles, not as a single hard-coded canon.
4. Manuscript-first reconstruction: preserve the witness, date/range, language, repository, transcription, corrections, lacunae, and provenance.
5. Variant-aware: no verse is treated as a single immutable string when the manuscript tradition contains meaningful variants.
6. Translation separation: original-language witnesses, reconstructed critical text, and modern translations are distinct layers.
7. Faith/history separation: theological claims, historical claims, and textual-critical conclusions use different truth-state labels.
8. Reproducible reasoning: every reconstruction decision must expose the evidence and rule used.
9. Copyright-safe ingestion: store public-domain, licensed, user-provided, or metadata-only material according to rights.
10. ATLAS governance: tenant, RBAC, audit, provenance, versioning and evidence rules apply.

## 3. Product surfaces

### 3.1 Relationship Graph

The visual concept is inspired by cross-reference arc visualizations such as the widely shared Bible cross-reference graph, but implemented as an interactive ATLAS graph rather than a static image.

Supported edge types include:

- QUOTES
- ALLUDES_TO
- PARALLEL_TO
- FULFILLS
- REFERENCES
- SHARES_PERSON
- SHARES_PLACE
- SHARES_EVENT
- SHARES_THEME
- MANUSCRIPT_VARIANT_OF
- TRANSLATION_OF
- COPIED_FROM_OR_RELATED_TO
- CANON_INCLUDES
- CANON_EXCLUDES
- CORRECTED_BY
- ATTESTED_BY
- DISPUTED_BY
- SUPPORTED_BY
- CONTRADICTS
- DATED_BEFORE
- DATED_AFTER

Every edge must have:
- source(s)
- confidence
- relation method
- creator/importer
- created_at / verified_at
- status: verified | probable | possible | disputed | unverified

### 3.2 Passage Workbench

For any passage, show side-by-side:

- Hebrew / Aramaic / Greek witness text when legally available
- transliteration
- literal gloss
- reconstructed critical reading
- manuscript witnesses
- ancient translations
- modern licensed/public-domain translations
- textual variants
- cross-references
- historical notes
- theological interpretations by tradition
- confidence and provenance

### 3.3 Manuscript Explorer

Each witness is a first-class entity.

Minimum fields:
- manuscript_id
- conventional_name
- catalog identifiers
- estimated date / date range
- language
- material
- script
- current repository
- provenance history
- digitization URL
- transcription source
- books/passages preserved
- lacunae
- corrections / corrector hands where documented
- scholarly bibliography
- rights / license

Initial source families should include:
- Dead Sea Scrolls / Judean Desert biblical manuscripts
- major Septuagint witnesses
- Codex Sinaiticus
- Codex Vaticanus
- Codex Alexandrinus
- early New Testament papyri
- later Greek manuscript tradition
- early versions such as Latin, Syriac, Coptic and others where evidence is relevant

### 3.4 Canon Matrix

ATLAS must not reduce "the Bible" to one book count.

The Canon Matrix should compare:
- Jewish/Tanakh
- Protestant
- Catholic
- Greek Orthodox
- Russian Orthodox
- other Eastern/Oriental Orthodox profiles
- Ethiopian Orthodox Tewahedo
- historically attested collections

For each work:
- included/excluded by profile
- naming differences
- ordering differences
- additions/longer forms
- historical attestation
- date/range of canon evidence
- notes on counting conventions

### 3.5 Variant Explorer

A variation unit is modeled explicitly.

For each variant:
- passage
- reading
- supporting witnesses
- witness dates
- geographic/language distribution when supported
- internal evidence
- external evidence
- genealogical/coherence evidence when available
- current scholarly assessment
- confidence
- unresolved questions

The initial-text layer must never be represented as an extant autograph unless evidence exists. It is a reconstruction.

### 3.6 Timeline

Navigate:
- composition estimates
- manuscript dates
- translation milestones
- canon history
- councils/synods where relevant
- major textual editions
- discoveries
- corrections and publication history

Timeline entries must separate:
- event fact
- scholarly inference
- theological interpretation
- later tradition

### 3.7 "Why this reading?" panel

Any reconstructed reading must answer:
- Which witnesses support it?
- How old are they?
- Are there competing readings?
- What method selected this reading?
- What would change the conclusion?
- What is the confidence level?

## 4. Evidence model

Truth-state labels:

- DIRECT_WITNESS
- CRITICAL_RECONSTRUCTION
- HISTORICALLY_ATTESTED
- SCHOLARLY_CONSENSUS
- MAJORITY_VIEW
- MINORITY_VIEW
- TRADITIONAL_CLAIM
- THEOLOGICAL_CLAIM
- DISPUTED
- INSUFFICIENT_EVIDENCE
- UNKNOWN

These labels must never be collapsed into one generic "verified" badge.

## 5. Data model

Primary node types:

- Work
- Book
- Chapter
- Passage
- VerseReference
- Manuscript
- Fragment
- Reading
- VariationUnit
- Translation
- CanonProfile
- Person
- Place
- Event
- Language
- Institution
- Source
- ScholarlyClaim
- TheologicalClaim

Core provenance fields:
- source_uri
- source_type
- source_title
- publisher/institution
- publication_date
- access_date
- license
- evidence_grade
- verification_status
- last_verified_at

## 6. Reconstruction pipeline

INGEST
→ NORMALIZE
→ IDENTIFY WITNESS
→ DATE / PROVENANCE
→ ALIGN PASSAGES
→ EXTRACT VARIANTS
→ LINK PARALLELS / QUOTATIONS / THEMES
→ SCORE EVIDENCE
→ RECONSTRUCT CANDIDATE READING
→ HUMAN-READABLE RATIONALE
→ CONTRADICTION CHECK
→ VERSION
→ AUDIT
→ PUBLISH

No step may silently overwrite an earlier reconstruction. Every edition is versioned.

## 7. Research methodology

ATLAS Bible OS should align with established textual-critical practice rather than inventing a proprietary claim of certainty.

For New Testament textual history, the Institute for New Testament Textual Research (INTF) is a primary methodological reference because it documents the Greek manuscript tradition and reconstructs the initial text using the full manuscript tradition, early translations and patristic citations.

Reference resources:
- INTF: https://www.uni-muenster.de/INTF/en/
- NTVMR: https://ntvmr.uni-muenster.de/
- Codex Sinaiticus Project: https://www.codexsinaiticus.org/
- Leon Levy Dead Sea Scrolls Digital Library / Israel Antiquities Authority: https://www.deadseascrolls.org.il/

These sources are references and provenance targets; ATLAS must respect their licensing and terms.

## 8. Visual language

The relationship view should retain the useful idea from the reference Reel: thousands of connections can be perceived at once.

ATLAS implementation:
- arc mode for whole-canon overview
- force-directed graph for local exploration
- timeline mode
- manuscript stemma/coherence mode
- geographic manuscript map
- canonical comparison matrix

Interactions:
- hover: relation summary
- tap/click: open evidence drawer
- filter by relation type, date, manuscript, language, canon, confidence
- hide inferred edges
- show only direct quotations
- show only disputed passages
- trace one concept from earliest witness through later translations

Accessibility:
- keyboard navigation
- non-color-only relation encoding
- screen-reader graph summaries
- reduced-motion mode
- table alternative for every graph

## 9. AI behavior

ATLAS Assistant may:
- explain textual variants
- compare witnesses
- summarize competing scholarly positions
- generate graph queries
- translate with explicit source-language caveats
- identify unresolved questions

ATLAS Assistant must not:
- fabricate manuscript readings
- call a theological belief "historically proven" without evidence
- present one canon as universally authoritative
- claim discovery of a suppressed text without primary evidence
- hide disagreement
- conflate modern translation wording with the earliest attainable text

## 10. Initial delivery slices

P0:
- Canon Matrix
- Passage Workbench schema
- Manuscript entity schema
- provenance/evidence labels
- relationship graph schema
- source registry
- audit/versioning rules

P1:
- Dead Sea Scrolls metadata adapter
- Codex Sinaiticus metadata/transcription adapter subject to rights
- NTVMR/INTF metadata links
- cross-reference graph
- variant explorer

P2:
- multilingual comparison
- canonical-tradition overlays
- historical timeline
- geographic manuscript view
- contradiction/claim explorer

## 11. Definition of done

A Bible OS claim is not "complete" merely because it renders in UI.

For a passage/reconstruction to be marked verified:
- at least one attributable source exists
- witness metadata is preserved
- competing readings are represented when material
- confidence is explicit
- provenance is inspectable
- audit/version record exists
- no unsupported theological/historical conflation is present

Production readiness additionally requires:
- tests
- RBAC
- tenant isolation where user annotations exist
- accessibility
- performance
- public-route verification
- no unsupported "complete/verified" badges

## 12. Relationship to Knowledge Atlas

ATLAS Bible OS is a specialized research surface under Knowledge Atlas, not a duplicate knowledge silo.

Knowledge Atlas owns:
- provenance
- graph relationships
- source registry
- evidence states
- contradiction tracking
- timelines

Bible OS owns:
- biblical manuscript modeling
- canon profiles
- passage/variant workbench
- textual-critical workflows
- biblical research UI

The same Universal Knowledge & Relationship Graph can later connect biblical persons, places, events and concepts to archaeology, history, languages, geography, philosophy and other Humanity Atlas domains while preserving domain-specific evidence labels.

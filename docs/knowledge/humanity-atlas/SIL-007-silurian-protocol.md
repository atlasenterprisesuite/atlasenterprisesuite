# SIL-007 — Deep-time geochemical anomaly protocol v1.0

**Owner:** Knowledge Atlas / Humanity Atlas. **Status:** proposed research protocol; no physical samples analyzed. **Scope:** methodological investigation, not a claim of prehuman industry.

## Research question
Can a reproducible, well-dated anomaly in ancient strata be explained by volcanism, impact events, diagenesis, biogeochemical cycles, analytical contamination, or another known mechanism? Only positive, discriminating evidence may support an otherwise unknown technological origin.

## Preregistered competing hypotheses
- H0: natural geochemical/sedimentological variation.
- H1: preparation/measurement contamination or processing errors.
- H2: specific natural event (volcanism, impact, climate perturbation, diagenesis).
- H3: unknown technological activity. H3 is never inferred solely by excluding H0–H2.

Record discriminating predictions, tests, stopping rules, thresholds, multiple-testing corrections, confounders, and disconfirmation criteria **before** unblinding samples. Unexplained is not technological.

## Pilot design (subject to feasibility/power assessment)
- Reuse existing curated geological cores and published datasets first.
- Tentative 3 independently sourced stratigraphic sections × 5 horizons × 3 specimens = 45 primary specimens, plus field/lab blanks, duplicates and certified reference materials. Not a statistically validated sample size.
- Capture stratigraphic context, position, depositional environment, sampling permissions, calibration data, model-of-age uncertainty, and custody events.
- Use negative controls adjacent to target horizons, relevant natural-event positive controls, standards and procedural blanks.
- Randomize analytical batches; blind samples to the analyst when feasible. Avoid pseudoreplication: sections, horizons, and technical replicates are distinct units.

## Measurement plan
- ICP-MS/ICP-OES metals and trace elements; instrument blanks, calibration checks, standards.
- Stable carbon isotopes with internationally recognized references.
- XRD and SEM/EDS for mineralogy and microstructures, with preparation controls.
- Organic geochemistry only where preservation and contamination screening permit.
- Dating: appropriate radiometric anchors + magneto-/bio-/astrochronology when justified; do not date a sediment by assuming the age of a detrital grain equals deposition age.
- Prespecify detection/quantification limits, uncertainty propagation, spike recovery, batch drift and instrument cross-checks.

## Evidence grades and claim guard
- E0: conceptual / no observational measurements.
- E1: preliminary observation without independent replication.
- E2: anomaly replicated with satisfactory QC.
- E3: origin unresolved after documented competing tests.
- E4: multiple independent positive technological discriminators, after alternative models are challenged.
- E5: independent confirmation, provenance, validated chronology, peer scrutiny, unequivocal manufacturing/technical evidence.
- E3 does **not** imply E4; these stages are not probabilities. Anomaly grade and origin attribution must be stored separately.
- Hard fail-closed: no 'technological origin confirmed' claim if custody, chronology, essential QC, independent replication, positive discriminating indicators, or peer review is absent.

## Sample schema and publication requirements
Each record: sample_id (unique opaque), section_id, horizon_id, depth and unit, date/time, custodian, source URI and license, reference material ID, analytical method/version, instrument, raw-data SHA-256, uncertainty, detection limit, QC verdict, age model and uncertainty, competing explanations, analysis code version, analyst and independent reviewer. Disallow secrets, precise protected sites, private identifying data in public exports. Multi-tenant records require RLS, RBAC and audit trail if persisted.

## Reproducibility and negative results
Freeze preregistration hash and code version before analysis. Retain immutable raw data and report every failed control, excluded sample, negative result, effect size, confidence interval and correction for multiple comparisons. A second independent lab must verify any extraordinary interpretation. Open metadata and permitted data with DOI/versioning. Do not auto-ingest untrusted PDFs as verified source records.

## Acceptance criteria
1. Structured specimens cannot be promoted to E2 without independent replication and QC.
2. A record cannot be promoted to E4 without independent, positive technological discriminators.
3. An E5 origin claim requires all strict gates plus independent expert review.
4. Missing provenance, age constraints or SHA-256 invalidates promotion.
5. Negative-control contamination prevents promotion.
6. Synthetic fixtures remain flagged synthetic; no production deployment or finding is implied.

## Scientific sources
- Schmidt, G.A. & Frank, A. (2018), *The Silurian Hypothesis*, International Journal of Astrobiology, https://doi.org/10.1017/S1473550418000095
- Geboy & Engle (2011), USGS geochemical QA/QC: https://doi.org/10.3133/ofr20111187

## Integration
Canonical repository location: docs/knowledge/humanity-atlas/. Proposed evaluator: tools/research/sil007/. No new production database, privileged integrations, environmental credentials, or deploy without explicit evidence of completed tests/approval gates.

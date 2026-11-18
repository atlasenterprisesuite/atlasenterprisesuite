# ATLAS 6G Pioneer — IMT-2030 requirements traceability (research baseline)

Review date: 2026-11-18. This document maps *areas to research* against primary institutional sources, not claims of implementation, certification, device compatibility, measured 6G performance, or approved commercial operations. Standards identifiers, status and revisions must be checked again at acceptance time.

## Primary source ledger

| Source | Scope | Current interpretation / boundary |
| --- | --- | --- |
| [ITU-R M.2160-0 (11/2023)](https://www.itu.int/rec/R-REC-M.2160/en) | IMT-2030 framework and overall objectives | Vision/reference framework; **not** laboratory acceptance criteria for ATLAS as currently modeled |
| [ITU-R WP 5D IMT-2030 programme](https://www.itu.int/en/ITU-R/study-groups/rsg5/rwp5d/imt-2030/pages/default.aspx) | Work programme and draft reports for minimum technical performance requirements, RIT submission/evaluation | Draft and approval stages evolve; document revision is mandatory before use |
| [ITU-R IMT family / WP 5D status](https://www.itu.int/en/ITU-R/study-groups/rsg5/rwp5d/pages/imt.aspx) | State of IMT-2030 technical performance and evaluation reports | Do not interpret publication of a framework as commercial network availability |
| [3GPP Release 20 study on 6G radio](https://portal.3gpp.org/desktopmodules/Specifications/SpecificationDetails.aspx?specificationId=4476) | 6G radio study work | A study item, not proof that ATLAS implements compliant radio hardware or software |
| [3GPP Release 20 study on 6G use cases and service requirements](https://portal.3gpp.org/desktopmodules/Specifications/SpecificationDetails.aspx?specificationId=4374) | Service scenarios and requirements under study | Version and study status must be captured before mapping a test |
| [3GPP Release 21 6G service requirements entry](https://portal.3gpp.org/desktopmodules/Specifications/SpecificationDetails.aspx?specificationId=5521) | Evolving 6G service requirements | Not an authorization to certify, operate or provision a network |

## Mapping to the existing research evidence engine

These names match `REQUIREMENTS` in `research/atlas-wireless-6g/atlas-6g-pioneer.mjs`.

| Readiness key | Minimum evidence required before manual review | Current ATLAS status |
| --- | --- | --- |
| `standards_traceability` | Specific published document + edition/date + clause + normalized requirement + test ID, reviewer and signed evaluation | **UNVERIFIED**: this source ledger alone is insufficient |
| `radio_testbed_authorization` | Named lab, written operator/spectrum permission, site and scope, responsible party, validity dates | **UNVERIFIED**; no RF transmission authorized |
| `device_capability_evidence` | Device make/model, firmware, certified capabilities, supported bands, authorized test records | **UNVERIFIED** |
| `interop_test_plan` | Version-pinned interfaces, real test systems, expected outcomes, reproducible scripts and rollback plan | **UNVERIFIED** |
| `security_privacy_review` | Threat model, access controls, data classification, signed risk disposition and independent review | **UNVERIFIED** |
| `measured_lab_results` | Lab-origin measurements with calibrated equipment, timestamps, device configuration, raw files and signed provenance | **UNVERIFIED**: synthetic simulation does not qualify |

## Model-specific invalid assumptions

- `simulateScenario()` takes user-selected synthetic traffic, capacity and latency heuristics. It does not implement radio propagation, scheduler, interference, RF waveform, mobility, beamforming, power, security, or any ITU technical performance conformance evaluation.
- It reports `networkGeneration: 'unspecified'`, `observed: false` and `provenance: 'synthetic_model'`; keep those flags unchanged until a separately verified measured-data pipeline exists.
- `evaluateReadiness()` is a metadata validity check, **not** a signature or authority verifier. An arbitrary caller can provide plausible `verified`, `reference`, and `verifiedAt`; these fields are not independently authenticated by the module.
- `service6gReady: false` and `commercialActivationAllowed: false` are unconditional. These are mandatory fail-closed boundaries.

## P0/P1 release gates

- P0: [#1065](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/1065) — `picomatch` advisory must be remediated with a trustworthy, lockfile-reproducible dependency solution; required `npm audit` and `verify:all` must pass.
- P0: [#503](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/503) — do not activate or claim commercial subscriber service without carrier, regulatory, billing, eSIM, emergency-service and production evidence.
- P1: Before promoting standards traceability to verified, link edition-pinned clauses to independent test evidence and peer review. The present checklist is only a research baseline.
- P1: E2E, authenticated read-only route behavior, accessibility and deployed exact-SHA integrity must be tested for the actual production build.

This document does **not** represent an approval, certification, release gate bypass, or 6G standard implementation.

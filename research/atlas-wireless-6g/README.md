# ATLAS Wireless 6G Pioneer — Research Engine (v0.1)

Non-production, deterministic simulator and evidence-readiness analyzer. No RF transmissions, telecom API integration, credentials, subscriber provisioning, or real-world measurements.

## Run tests

```sh
npm run test:6g
```

## Example

```js
import { simulateScenario, evaluateReadiness } from './atlas-6g-pioneer.mjs';
console.log(simulateScenario({offeredMbps:150,capacityMbps:100,baseLatencyMs:10}));
console.log(evaluateReadiness({}));
```

## Scope and limitations

- Throughput is capped at configured capacity, with excess demand treated as loss; it is **not** an empirical radio model or a packet-network queue simulator.
- Modeled latency is an illustrative deterministic heuristic, not a 3GPP or ITU prediction.
- `service6gReady` and `commercialActivationAllowed` remain false by design; research evidence alone must never activate subscriber services.
- Never feed this synthetic output to `atlas-wireless-mvno` provider readiness or subscriber state.
- Findings must remain labeled `synthetic_model`, never `observed`.

## Follow-up acceptance gates

1. Confirm applicable IMT-2030/3GPP requirements against primary standards and version them.
2. Identify authorized lab partner and written RF/spectrum access evidence before physical testing.
3. Integrate as a read-only research UI under existing ATLAS Wireless navigation, preserving auth/RBAC/tenant isolation.
4. The focused tests are wired into both canonical `verify:all` and `verify:cloudflare`; await CI success, exact-SHA evidence, review and E2E for any future research UI.
5. Maintain Issue #503 as separate P0 blocker for all commercial network activations.

No claim of a 6G carrier, commercial availability, 6G mobile device capability, or measured 6G performance is made.

## Read-only web route (proposed, not deployed)

- The existing authenticated ATLAS Connect router includes `/connect/wireless/6g-research`.
- The page renders synthetic model outputs locally; no provider API, storage, RF control, eSIM provisioning, or commercial mutation path is invoked.
- `tests/unit/atlas-wireless-6g-ui.test.tsx` checks rendering, invalid inputs, reset, and explicit activation blockade.
- This PR does not expose an evidence-upload system, measure a 6G radio, or assert that production is deployed.
- A successful PR CI run, accessibility verification, integration/E2E, code review, and exact-SHA proof are outstanding acceptance gates.

## IMT-2030 experiment suite (new)

`imt2030-lab.mjs` runs deterministic, bounded **synthetic** batches of up to 32 scenarios with aggregated capacity/latency/loss heuristics. It records `complianceStatus: not_assessed`, `evidenceClass: simulation_not_measurement` and explicitly disallows radio transmissions, 6G commercial claims and subscriber activation. The new `imt2030-lab.test.mjs` covers repeatability, invalid inputs and fail-closed behavior; `npm run test:6g` runs both test files.

`planSecondLine()` represents a **new number request only**; it never assigns a number, issues an eSIM or charges an account. A real number with calls/SMS/mobile data requires an authorized carrier, compatible unlocked device, paid plan where applicable, and the operator's explicit activation flow. ATLAS cannot produce 6G network service using software alone. Existing SIM/eSIM must not be removed by research workflows.

### Primary references and engineering milestones

- ITU-R M.2160: https://www.itu.int/rec/R-REC-M.2160/en (framework, **not** certification).
- ITU-R WP5D IMT-2030 status: https://www.itu.int/en/ITU-R/study-groups/rsg5/rwp5d/imt-2030/pages/default.aspx
- 3GPP Release 20 6G studies and Release 21 normative roadmap require edition-pinned verification before conformance claims.
- Implementation sequence: synthetic repeatability → version-pinned requirements → authorized measurement pipeline → controlled RAN research hardware and licensed spectrum/lab → external interoperability/conformance review. Current phase is **synthetic repeatability only**.
- Security #1065 (`picomatch`), commercial launch #503, independent review, release CI and production E2E remain P0 blockers.

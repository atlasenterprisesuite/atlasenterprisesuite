# ATLAS Wireless 6G Pioneer — Research Engine (v0.1)

Non-production, deterministic simulator and evidence-readiness analyzer. No RF transmissions, telecom API integration, credentials, subscriber provisioning, or real-world measurements.

## Run tests

```sh
node --test research/atlas-wireless-6g/atlas-6g-pioneer.test.mjs
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
4. Add CI tests, verify:all, PR review, exact-SHA evidence, and E2E for the research UI.
5. Maintain Issue #503 as separate P0 blocker for all commercial network activations.

No claim of a 6G carrier, commercial availability, 6G mobile device capability, or measured 6G performance is made.

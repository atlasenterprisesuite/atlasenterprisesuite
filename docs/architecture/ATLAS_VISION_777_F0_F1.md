# ATLAS Vision 777 — F0/F1 engineering contract

Status: DRAFT / NO-GO for hardware, production, purchasing, merge, or deployment.
Owner: ATLAS Device OS. Date: 2026-11-20.

## Reuse and canonical boundaries

- Reuse `apps/web/src/modules/device-os/deviceOSModel.ts` profile `glasses`; its physical capabilities are `adapter-required`.
- Reuse `apps/web/src/modules/device-os/deviceEvolutionModel.ts` concept `vision`, which remains `research-track`.
- Follow `docs/architecture/ATLAS_DEVICE_DNA_HARDWARE_ECOSYSTEM.md`: software claims do not establish hardware readiness.
- Evaluate `unity/atlas-ar-drive` for rendered HUD patterns and `apps/visionos/AtlasSpatial` for spatial allowlist patterns, but do not claim either runs on custom glasses.
- Use canonical ATLAS Identity, privacy, Connect and audited device bridges. Avoid a separate identity or tenant database.

## Tracks

A. Benchmark Snap SPECS capabilities, Lens Studio SDK availability, portability and licensing; proprietary services are not canonical dependencies.
B. Build ATLAS-owned interface and adapter contracts; evaluate open SDK boards and OEM optics as research options, no purchase authorization.

## F1 minimum viable simulation

Simulated text HUD in a desktop/mobile browser: caption, translation and context card. Simulated adapter emits only explicitly labeled synthetic events; no camera/microphone access by default. Device pairing and live streaming are out of scope until authenticated capabilities exist.

Expected data contract:
- `device_id`, `tenant_id`, `session_id`, `event_id`, `timestamp`, `kind` (`caption`|`translation`|`context`), `text`, `source` (`simulated`|`adapter-observed`), `consent_scope`.
- Reject unknown kinds, missing identity/consent, cross-tenant identity, overlong text, and replays.
- No storing raw audio/images by default; sensitive processing requires explicit, revocable, scoped permission and logged purpose.
- Physical capture indicator is a hard hardware P0 gate; software UI alone does not prove physical disconnection.

## Test-first acceptance (not yet passed)

1. Profile `glasses` remains present with camera, waveguide and microphone all adapter-required.
2. Concept `vision` remains research-track until separate hardware evidence.
3. Simulation refuses input without authenticated tenant, permission and explicit simulated source; must not infer verified hardware.
4. Simulated captions, translations and context render accessibly with keyboard and screen-reader support, including reduced-motion.
5. Expiration/revocation immediately blocks capture and makes downstream adapter operations fail closed.
6. Unit, integration, typecheck, build and `verify:all` run on the exact PR SHA; record job URLs, reports and artifact digests.
7. Physical optical safety, battery, temperature, camera indicator, EMC/radio/regulatory assessment and real-device tests must each be evidenced before hardware readiness.

## Evidence ledger

| Gate | Status | Evidence |
| --- | --- | --- |
| F0 repository reuse reconnaissance | inspected | Existing model/docs examined, not CI proof |
| F1 browser prototype | pending | None |
| Automated verification at PR SHA | pending | None |
| Real hardware | blocked | No device |
| Production | NO-GO | No E2E / exact-SHA verification |

## Decision

Create draft PR only. No merge, deploy, purchase, recording, or device access authorized by this document.

# ATLAS Wireless Provider Due Diligence

Status: external-gated. Research snapshot: 2026-09-25.

## Decision boundary

ATLAS has a provider-neutral MVNO control-plane contract in production, but no live carrier/MVNE has been authorized. This document separates public vendor capability evidence from contractual facts that still require direct confirmation.

Do not mark `pending_provider` as `provisioning` or `active` from marketing pages, sandbox behavior, mock data or internal UI state.

## Immediate pilot candidates

| Candidate | Publicly evidenced strengths | Publicly evidenced gaps / questions | ATLAS use |
|---|---|---|---|
| Gigs | API for smartphone/wearable wireless subscriptions; eSIM-compatible plans; SIMs, subscriptions, phone numbers, usage, porting, billing and webhooks. Public materials describe local talk/text/data, hotspot, carrier-of-record and telecom tax capabilities. | Commercial pricing, specific U.S. network/plan availability for ATLAS, minimums, pilot eligibility, SLA, E911/CALEA responsibility split and exact suspension/reconnect semantics require contractual confirmation. | Primary consumer-MVNO diligence path. |
| Telnyx | API-driven SIM/eSIM, IoT data, programmable mobile voice, PAYG entry for IoT connectivity and API provisioning. | Public evidence does not establish a turnkey white-label consumer MVNO carrier-of-record model for ATLAS. Mobile Voice and eSIM rates are custom. Porting, retail billing/tax and consumer support scope must be confirmed. | Technical connectivity / enterprise-mobile alternative; secondary diligence path. |
| Soracom | Strong IoT SIM/eSIM APIs, U.S. plans, lifecycle states, multi-profile subscription containers and satellite NB-IoT option through Skylo on supported plans. | Primarily IoT/data oriented; not public evidence of a U.S. consumer unlimited talk/text retail MVNO stack. | Home Hub, IoT and future satellite/NTN research path, not the first consumer-phone pilot. |

## Primary-source evidence

### Gigs

- API overview: https://developers.gigs.com/
- Core API: https://developers.gigs.com/api/latest/core
- Create subscription / eSIM provisioning state: https://developers.gigs.com/docs/create-a-subscription
- Events and webhooks: https://developers.gigs.com/docs/core/events/events-webhooks
- Porting: https://developers.gigs.com/docs/porting/how-porting-in-works
- Billing: https://developers.gigs.com/docs/billing/billing-users
- MVNO-in-a-box / carrier-of-record positioning: https://gigs.com/use-cases/mvno-in-a-box
- OSS/BSS feature scope: https://gigs.com/oss-bss

Public evidence shows a subscription can move from `pending` to `active` after network-provider provisioning and that activation events can be consumed by webhook. ATLAS must treat the Gigs event as provider evidence, not allow the browser to invent the transition.

### Telnyx

- IoT SIM pricing and API entry: https://telnyx.com/pricing/iot-data-plans
- Programmable mobile voice: https://telnyx.com/products/mobile-voice

Public pricing shows PAYG access for IoT connectivity and separate committed/enterprise tiers, while eSIM and Mobile Voice are shown as custom-rate products. These public prices must not be reused as ATLAS retail-plan economics without a written quote.

### Soracom

- SIM types and U.S. plans: https://developers.soracom.io/en/docs/air/sim-types/
- Subscription containers: https://developers.soracom.io/en/docs/air/subscription-containers/
- Current fee schedule: https://developers.soracom.io/en/docs/reference/fees/
- Connectivity Hypervisor / additional profiles: https://developers.soracom.io/en/docs/air/connectivity-hypervisor/

Soracom documents U.S. IoT plans, API-controlled SIM states and additional profiles. Its public docs also describe a Skylo satellite NB-IoT subscription option on supported plans. This is useful for ATLAS Home Hub / IoT / NTN research, but it is not evidence of consumer voice/SMS MVNO readiness.

## U.S. regulatory diligence

ATLAS must confirm which obligations are retained by the provider and which attach to ATLAS under the chosen commercial model.

- USAC states non-exempt telecommunications providers, including resellers, must register for a 499 Filer ID; an FCC FRN is required first.
  - https://www.usac.org/service-providers/get-started/
  - https://www.usac.org/service-providers/contributing-to-the-usf/register-for-a-499-id/
- FCC CPNI rules require telecommunications carriers and interconnected VoIP providers to protect CPNI and certify compliance.
  - https://consumercomplaints.fcc.gov/hc/en-us/articles/8824334151572-Privacy-Complaints
- FCC wireless port-out rules apply customer-authentication protections to CMRS providers, including resellers.
  - https://docs.fcc.gov/public/attachments/FCC-23-95A1_Rcd.pdf
- FCC wireless 911 location requirements are substantially more specific than the old “300 meter” shorthand; modern indoor accuracy includes x/y and vertical-location requirements.
  - https://docs.fcc.gov/public/attachments/FCC-15-9A1_Rcd.pdf
  - https://docs.fcc.gov/public/attachments/FCC-25-22A1_Rcd.pdf
- Robocall-mitigation compliance is an active enforcement area for voice providers; responsibility and database/STIR-SHAKEN obligations must be confirmed before public voice service.
  - https://docs.fcc.gov/public/attachments/DOC-413519A1.pdf

Do not automate a live 911 call as a normal CI test. Emergency-call validation must follow the carrier's approved test procedure and any PSAP/test-number coordination required by that provider.

## Provider acceptance packet

Before ATLAS marks a provider as verified, obtain and retain evidence for:

1. Executed pilot/wholesale agreement or explicit written pilot authorization.
2. Named legal entity acting as carrier of record and a written responsibility matrix for FCC/USAC, E911, CPNI, CALEA, STIR/SHAKEN/robocall mitigation, telecom taxes, number portability and customer notices.
3. U.S. network and plan identifiers approved for the pilot.
4. Test eSIM/SIM inventory with non-secret references: SIM ID/ICCID, EID when required, MSISDN for voice lines and provider-side subscription ID.
5. Sandbox and production API base URLs plus documented authentication method.
6. Secret delivery through the approved ATLAS secret store; never through source control, browser state or issue comments.
7. Webhook/event documentation and signing/verification method.
8. Provision/create-subscription, status, restrict/suspend, restore/reconnect, cancel/end/revoke, usage and porting semantics.
9. Billing/usage source of truth, invoice/tax responsibilities, dispute/refund process and reconciliation cadence.
10. E911 test procedure and written confirmation of responsibility split.
11. Lawful-intercept / CALEA responsibility statement and escalation contact, where applicable.
12. Support and incident contacts, rate limits, SLA, maintenance windows and termination/port-out process.

## ATLAS adapter mapping

The current provider-neutral contract should be mapped only after the provider documentation is received:

| ATLAS operation | Provider evidence required |
|---|---|
| `provision` | Create subscription / assign SIM or eSIM / provider subscription ID |
| `getSubscriber` | Authoritative subscription + SIM status |
| `activate` | Provider/network-confirmed activation event or authoritative active state |
| `suspend` | Documented restriction or suspension operation |
| `reconnect` | Documented restore/reactivation operation |
| `revoke` | Documented cancellation/end/termination semantics |
| usage | Usage endpoint or signed usage event/feed |
| number management | Number assignment plus port-in/port-out workflows |
| E911 | Provider-approved emergency-service configuration and test evidence |

If a provider has a different state machine, the adapter must translate it without inventing states. The last verified external state wins.

## Next diligence sequence

1. Open commercial/technical diligence with Gigs for one internal U.S. eSIM voice/text/data test line.
2. In parallel, validate Telnyx as a technical fallback and enterprise/mobile-voice option.
3. Keep Soracom on the Home Hub/IoT/NTN track rather than using it as evidence for a consumer-phone launch.
4. Request written answers to every acceptance-packet item above.
5. Only after credentials and test inventory are issued, implement the first real server-side provider adapter and webhook verifier behind ATLAS RBAC/audit.
6. Run one internal line through order -> pending_provider -> provisioning -> active -> suspend -> reconnect -> revoke, preserving immutable evidence.
7. Keep commercial launch blocked until regulatory, billing, tax, E911 and support gates are independently closed.

## Research corrections

The research report that preceded this document overstates two areas:

- `/connect/wireless/mvno` is currently a web/control-plane route, not a family of live server-side REST endpoints for provision/activate/status/suspend/reconnect/revoke.
- ATLAS does not yet operate an SM-DP+, SM-SR or carrier core integration. GSMA eSIM standards inform future adapter design but are not evidence of a live GSMA RSP implementation inside ATLAS.

These corrections preserve the project fail-closed rule and prevent research prose from being mistaken for deployed capability.

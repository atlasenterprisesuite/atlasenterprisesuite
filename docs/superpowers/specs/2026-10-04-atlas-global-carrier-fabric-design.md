# ATLAS Global Carrier Fabric — Architecture Design

Date: 2026-10-04
Status: Design for review
Scope: ATLAS Communication / ATLAS Carrier

## 1. Intent

ATLAS Carrier must evolve from a provider-neutral telephony control plane into a global, multi-path carrier fabric that can support smartphones, IoT devices, PSTN, mobile/eSIM, private 4G/5G, roaming, and future NTN/satellite connectivity without making any single upstream provider indispensable.

ATLAS owns the orchestration, policy, evidence, identity, billing/ledger, security, observability, routing decisions, and resource truth. External providers supply capabilities ATLAS does not yet own or is not legally authorized to operate, including spectrum/RAN access, roaming, regulated numbering, PSTN interconnect, and satellite transport.

Success means:

1. No ATLAS Communication feature binds directly to a specific carrier.
2. Telnyx, Bandwidth, BICS/Plintron, direct MNOs, private RAN, and NTN paths can coexist behind stable ATLAS contracts.
3. Loss of one provider does not require redesigning ATLAS.
4. No number, SIM/eSIM, network path, or calling capability is represented as active without authenticated external or ATLAS-owned infrastructure evidence.
5. Jurisdiction-specific regulatory rules fail closed and are sourced from authoritative primary evidence before becoming production policy.
6. ATLAS can progressively replace external dependencies with its own authorized infrastructure without changing consumer-facing contracts.

## 2. Non-negotiable principles

### 2.1 Provider neutrality

The architecture is `ATLAS-first`, not `Telnyx-first`, `Bandwidth-first`, or `MNO-first`. Providers are adapters. ATLAS Communication talks only to ATLAS Carrier Fabric contracts.

### 2.2 Evidence before state

Inventory discovery is not ownership. An API response that lists a number, network, SIM, profile, or route cannot by itself produce an `ACTIVE` resource.

All positive lifecycle transitions require authenticated evidence persisted in the Evidence Ledger and validated against the applicable authorization and jurisdiction policy.

### 2.3 Fail closed

Unknown provider state, unknown jurisdiction, stale evidence, failed health probes, expired authorization, missing emergency capability, missing KYC/contract status, or ambiguous ownership blocks activation/routing rather than silently falling back to an unsafe path.

### 2.4 No secondary-source regulation in production

Secondary sources may create research candidates. Production compliance policy requires a primary authoritative source such as a regulator, statute/regulation, official numbering authority, recognized standards body, or executed carrier agreement. Every production rule stores source provenance, jurisdiction, effective date, review date, and version.

### 2.5 Progressive sovereignty

ATLAS may begin with external providers, then move capabilities inward:

`Adapter -> Multi-provider aggregation -> Full MVNO/MVNE relationship -> ATLAS Mobile Core -> Private 4G/5G/Open RAN -> spectrum lease/local authorization -> facilities-based ATLAS where economically and legally justified.`

External networks remain usable for redundancy even when ATLAS owns infrastructure.

## 3. Target architecture

```text
Device / Smartphone / IoT
        |
        v
ATLAS SIM/eSIM + Device Identity
        |
        v
ATLAS Mobile Core / Subscription Control
        |
        v
ATLAS Network Intelligence
        |
        v
ATLAS Global Carrier Fabric
   |        |        |        |
   v        v        v        v
PSTN     Mobile    Private    NTN
Adapters Adapters  RAN        Satellite
   |        |        |        |
Telnyx   MVNO/MNO  CBRS/...  Satellite partners
Bandwidth BICS/... Open RAN   Future direct NTN
   \        |        |       /
    ---- Internet / PSTN / Mobile Networks ----
```

The fabric is composed of the following control-plane services.

## 4. Core components

### 4.1 Carrier Registry

Canonical registry of every provider/path known to ATLAS.

Each provider record includes:

- provider ID and adapter type;
- capabilities: voice, SMS, MMS/RCS where supported, numbering, eSIM, mobile data, roaming, emergency, private RAN, NTN;
- jurisdictions and regulatory scope;
- credential/readiness state;
- commercial/contract state without exposing secrets;
- SLA and health configuration;
- supported evidence types;
- emergency capabilities;
- lifecycle state: `discovered`, `onboarding`, `credentialed`, `verified`, `eligible`, `degraded`, `suspended`, `revoked`.

`eligible` requires authenticated provider readiness plus applicable compliance gates. A provider record alone never proves network service.

### 4.2 Adapter Contract v2

All external and ATLAS-owned network paths implement capability-scoped interfaces rather than one oversized provider interface.

Common operations:

```text
readiness()
capabilities()
health()
searchNumbers(criteria)
reserveNumber(candidate)
orderNumber(candidate)
getAllocationEvidence(order)
configureVoice(resource)
releaseNumber(resource)
getEsimInventory(criteria)
orderEsim(request)
getEsimActivationEvidence(order)
verifyMobileNetwork(subscription)
getUsageEvidence(resource, window)
getCallEvidence(session)
```

Optional capability interfaces cover roaming, data sessions, messaging, emergency routing, private RAN, and NTN. Unsupported methods return explicit `UNSUPPORTED_CAPABILITY`; they never simulate success.

Provider credentials remain server-side in the approved secret manager. Adapter responses are normalized before entering the ATLAS domain.

### 4.3 Canonical resource lifecycle

Numbering lifecycle:

`discovered -> reserved -> ordered -> allocated -> provisioned -> verified -> active -> suspended/released`

eSIM/subscription lifecycle:

`unavailable -> ordered -> allocated -> activation_ready -> installed -> network_verified -> active -> suspended/revoked`

Network-path lifecycle:

`discovered -> authorized -> configured -> verified -> eligible -> degraded/suspended/revoked`

Transitions are monotonic except explicitly defined operational states such as `active -> suspended -> active`, where reactivation requires fresh evidence.

The existing numbering truth gate remains authoritative and must not be weakened by Adapter Contract v2.

### 4.4 Evidence Ledger

Append-only evidence records bind lifecycle transitions to proof.

Minimum evidence envelope:

```text
provider_id
resource_type
resource_id
external_resource_id
jurisdiction
operation
observed_at
received_at
verification_method
evidence_digest
signature/webhook verification status
source authority
source event/order/CDR ID
actor/service identity
organization_id
correlation_id
```

Sensitive raw payloads are encrypted or redacted according to policy. Activation material such as eSIM QR codes, matching IDs, SM-DP+ secrets, API keys, and authentication tokens is never stored in ordinary logs.

A database row created by ATLAS is not self-authenticating evidence of an external allocation.

### 4.5 Jurisdiction Policy Engine

Evaluates whether a requested capability is legally and operationally eligible in a jurisdiction.

Policy dimensions include, where applicable:

- numbering authority and number-use rights;
- provider/telecom authorization;
- KYC/KYB requirements;
- emergency calling and location obligations;
- caller-ID authentication/anti-spoofing requirements;
- lawful intercept/data-retention obligations;
- portability and port-out controls;
- messaging/marketing restrictions;
- SIM/eSIM issuance requirements;
- spectrum/RAN authorization;
- data residency/privacy requirements.

Every enforceable policy has:

```text
jurisdiction
policy_key
policy_version
effective_from/effective_to
primary_source_uri
primary_source_authority
source_retrieved_at
review_due_at
rule_digest
status = draft | reviewed | enforceable | expired
```

Only `enforceable` policy can authorize a positive production transition. Missing or expired mandatory policy blocks the operation.

### 4.6 Network Intelligence / Policy Router

Chooses among eligible paths only. It cannot override truth/compliance gates.

Candidate scoring can use:

- provider health;
- jurisdiction eligibility;
- destination/source;
- measured latency, jitter, packet loss and call quality;
- signal/network measurements for mobile paths;
- cost and committed spend;
- capacity/rate limits;
- tenant policy;
- roaming state;
- emergency capability;
- historical success rate;
- failover priority.

The router produces a decision record explaining why a path was selected or rejected.

### 4.7 Provider Health Score

Health is measured per capability and region, not as a single provider-wide boolean.

Example dimensions:

- API availability;
- provisioning success rate;
- call setup success;
- call quality/MOS when measurable;
- latency/jitter/packet loss;
- messaging delivery evidence;
- data-session attach/success;
- webhook/CDR freshness;
- provider incident state;
- credential validity;
- balance/credit risk where relevant.

A provider may be healthy for US PSTN but ineligible for mobile data in another jurisdiction.

### 4.8 Failover and circuit breaker

Failover operates only between paths that independently satisfy truth and compliance requirements.

Rules:

1. Never fail over to an unverified provider.
2. Never substitute a caller ID/number not allocated to the tenant.
3. Never bypass emergency-policy requirements to preserve availability.
4. Circuit-break providers/capabilities after configurable failure thresholds.
5. Use bounded retries and idempotency keys for provisioning mutations.
6. Preserve correlation/evidence across retries and provider changes.
7. Human approval can be required for high-risk or regulated migrations, but routine safe routing can be automated.

### 4.9 Billing and Usage Ledger

Provider invoices are not the sole system of record. ATLAS normalizes usage events into its own immutable billing/usage ledger while retaining reconciliation links to provider CDRs, data-session records, messages, number rental, eSIM charges, roaming, and satellite usage.

Billing must distinguish estimated/unbilled usage from provider-confirmed charges.

### 4.10 Subscriber, SIM/eSIM and Device Identity

ATLAS maintains a provider-neutral subscriber identity model. IMSI/ICCID/eSIM profile identifiers remain distinct from PSTN/DID/MSISDN resources.

A mobile subscription may be linked to a number only after authenticated provider evidence establishes that relationship.

The design must support future multi-profile/multi-IMSI orchestration without assuming every consumer device permits arbitrary real-time profile switching.

## 5. Connectivity classes

The Fabric treats connectivity as four independent but composable classes.

### PSTN/CPaaS

Initial adapters may include Telnyx and Bandwidth, with additional CPaaS/wholesale providers later. Used for numbering, SIP/PSTN, messaging where authorized, emergency capabilities, and CDR evidence.

### Mobile/MVNO/MVNE/MNO

Wholesale mobile relationships provide SIM/eSIM, data, voice/SMS where supported, roaming, and deeper subscriber control. BICS/Plintron or direct regional partners are candidates, subject to commercial and regulatory verification.

### Private RAN

ATLAS-controlled private LTE/5G/Open RAN may be deployed where local spectrum rules and economics permit. Private RAN does not automatically grant public PSTN numbering or nationwide roaming rights.

### NTN/Satellite

Satellite is a separate transport/capability class. It can provide resilience and remote coverage but must not be represented as universal smartphone satellite service unless device, spectrum, partner and jurisdiction evidence confirms it.

## 6. Regional strategy

ATLAS uses one global control plane with jurisdiction-specific provider and compliance configuration.

- United States/Canada: multi-provider PSTN plus mobile wholesale; private/shared spectrum where authorized; direct numbering/facilities path later.
- Latin America/Caribbean: regional/local numbering and mobile partners behind the same adapters; country-specific policy packs.
- Europe/UK: local numbering/mobile partners and country-specific regulatory packs; shared/private spectrum evaluated per jurisdiction.
- Asia-Pacific: local/MVNE/MNO partnerships where foreign provider and SIM rules require them; no assumption of uniform regional licensing.
- India: dedicated policy/provider pack because telecom/SIM requirements are jurisdiction-specific and must be validated from DoT/TRAI primary sources before activation.
- Africa/Middle East: carrier/MVNE/roaming partners plus NTN where justified; country-specific authorization gates.
- Oceania: local carrier/numbering partners plus NTN for remote resilience.

No region is marked supported merely because an upstream vendor advertises global coverage.

## 7. Security model

- secrets server-side only;
- tenant/organization scope on every mutation;
- least-privilege RBAC for search, ordering, activation, release, porting, eSIM delivery and policy changes;
- signed webhook verification and replay protection;
- idempotency for all external mutations;
- immutable audit trail for state transitions and routing decisions;
- no plaintext activation secrets in logs;
- no provider credential exposure to browser/mobile clients;
- explicit port-out/SIM-swap controls;
- caller-ID authorization enforcement;
- security events can immediately suspend affected resources;
- evidence and policy digests detect tampering/staleness.

## 8. Production truth gates

A provider/capability is not production-eligible until all applicable gates pass:

1. executed/authorized carrier or network relationship;
2. applicable jurisdiction policy is current and enforceable;
3. production credentials stored securely and authenticated;
4. provider capability/readiness probe succeeds;
5. requested resource is actually ordered/allocated by the authorized provider;
6. authenticated allocation/provisioning evidence is persisted;
7. tenant/subscriber authorization is valid;
8. required emergency/compliance configuration is verified;
9. signed webhook/CDR/network evidence is accepted;
10. controlled end-to-end verification succeeds;
11. audit evidence exists;
12. deployed SHA/configuration is verified.

Until then the UI/API reports `BLOCKED`, `NOT_VERIFIED`, `DEGRADED`, or the appropriate truthful state — never `LIVE`.

## 9. Migration from current Carrier Control Plane

The existing control plane remains the foundation.

Phase A — Contract extraction:
- preserve current truth gate and numbering tables;
- formalize capability-scoped Adapter Contract v2;
- move Telnyx-specific assumptions behind its adapter;
- add canonical provider registry and evidence envelope.

Phase B — Multi-provider fabric:
- implement Bandwidth/second-provider adapter;
- add provider health scoring, routing decisions, circuit breakers and failover;
- add reconciliation and normalized usage evidence.

Phase C — Global policy and mobile:
- introduce versioned jurisdiction policy packs backed by primary sources;
- integrate first wholesale/MVNE mobile partner;
- implement provider-neutral subscriber/eSIM orchestration and mobile network verification.

Phase D — ATLAS-controlled network paths:
- integrate private LTE/5G/Open RAN path where authorized;
- integrate NTN adapter;
- add ATLAS Mobile Core capabilities as justified.

Phase E — Facilities-based evolution:
- pursue direct numbering, spectrum leasing/local licenses, interconnect and owned RAN only where regulatory authorization and economics support it;
- retain external providers for roaming, redundancy and international reach.

## 10. Testing and verification

Required test classes:

- adapter contract tests using provider fixtures/sandboxes;
- lifecycle monotonicity and truth-gate tests;
- evidence validation/signature/replay tests;
- jurisdiction policy expiry/missing-source fail-closed tests;
- tenant isolation/RBAC tests;
- idempotent provisioning tests;
- failover tests proving no ineligible path is selected;
- circuit-breaker recovery tests;
- usage/CDR reconciliation tests;
- controlled production canary only after external authorization;
- exact-SHA production verification.

Negative tests are first-class: missing credentials, stale policy, forged webhook, mismatched external ID, provider outage, unallocated caller ID, unsupported emergency calling, and cross-tenant resource access must all fail closed.

## 11. Observability and SLOs

Track by provider, capability, jurisdiction and tenant:

- provisioning success/time;
- call setup success and completion;
- MOS/latency/jitter/packet loss when available;
- messaging delivery;
- mobile attach/data-session success;
- failover attempts/success/recovery time;
- provider API/webhook freshness;
- evidence rejection reasons;
- policy blocks;
- cost per minute/message/MB/session;
- reconciliation variance.

No dashboard converts missing telemetry into a healthy state.

## 12. Explicit non-goals for initial implementation

- claiming ATLAS is already an MNO or facilities-based carrier;
- acquiring spectrum before a validated business/regulatory case;
- building a nationwide physical RAN during the adapter phase;
- bypassing provider KYC/KYB or regulatory onboarding;
- caller-ID spoofing or use of numbers not allocated to ATLAS/tenant;
- simulating carrier evidence to unlock production states;
- hard-coding one provider as the permanent global network.

## 13. Initial provider strategy

The architecture supports four independent paths without requiring all four for the first production call:

1. Telnyx — initial programmable pilot adapter, subject to verified production onboarding.
2. Bandwidth — independent PSTN/numbering path where its authorized footprint applies.
3. Wholesale/MVNE path — BICS, Plintron, or another validated partner for mobile/eSIM/global roaming, selected after commercial and regulatory diligence.
4. NTN path — satellite partner selected separately from terrestrial carriers and activated only where device/service/regulatory evidence permits.

Provider names are deployment candidates, not architectural dependencies or claims of current contracts.

## 14. Definition of done for the Fabric foundation

The foundation is complete only when:

- existing truth gates remain green;
- Adapter Contract v2 has contract tests;
- at least two independent provider adapters can be configured without ATLAS Communication knowing their identity;
- provider health and policy routing are evidence-driven;
- jurisdiction policy fails closed when missing/stale;
- evidence ledger supports normalized authenticated evidence;
- failover cannot select an unauthorized/unverified resource;
- tenant/RBAC/security tests pass;
- CI/security/readiness gates pass;
- production deployment SHA is verified;
- no PSTN/mobile capability is claimed live without external authenticated evidence.

## 15. Current truth state

This design does not change the current production truth. At design time, ATLAS must continue to treat PSTN/mobile activation as blocked until an authorized upstream relationship, credentials, actual allocation, verification, controlled E2E evidence, and production deployment evidence exist.

The Global Carrier Fabric expands the paths ATLAS can use; it does not lower the evidentiary standard required to use them.

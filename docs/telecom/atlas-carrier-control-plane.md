# ATLAS Carrier Control Plane

Status: implementation contract. External carrier activation remains fail-closed.

## Purpose

ATLAS Carrier is the provider-neutral control plane between ATLAS Communication and authorized telecom networks. ATLAS Communication MUST NOT bind directly to a carrier API.

Flow:

ATLAS Communication -> Carrier Control Plane -> Policy Router -> Provider Adapter -> authorized carrier / future ATLAS Direct -> PSTN or mobile network.

## Resource truth model

A phone number has distinct states:

- discovered: returned by an authenticated carrier inventory search; not owned by ATLAS.
- reserved: temporarily held by the carrier; not active.
- ordered: an authenticated order exists.
- allocated: the carrier returned allocation evidence tying the number to the ATLAS organization/account.
- verified: allocation evidence passed server-side validation and is persisted.
- active: verified allocation plus required voice configuration and a fresh provider readiness probe.
- revoked/released: unusable for origination.

UI labels MUST follow these states. Search results MUST never be displayed as owned numbers.

## eSIM truth model

An eSIM profile is separate from a PSTN/DID number. States:

- unavailable
- ordered
- allocated
- activation_ready
- installed
- network_verified
- suspended/revoked

An ICCID/eSIM UUID, QR code, SM-DP+ address, matching ID, or activation code is secret/sensitive provisioning material and MUST NOT be logged in plaintext or committed.

Installing an eSIM does not prove that a PSTN number is assigned to it. A mobile-number association must be verified separately from carrier evidence.

## Provider adapters

Every adapter implements:

- readiness()
- searchNumbers(criteria)
- reserveNumber(candidate)
- orderNumber(candidate)
- getAllocationEvidence(order)
- configureVoice(numberResource)
- releaseNumber(numberResource)
- getEsimInventory()
- orderEsim()
- getEsimActivationEvidence()
- verifyMobileNetwork()

Initial adapter target: Telnyx, subject to authenticated organization credentials and carrier approval.

Future adapters may include wholesale/MVNO providers. Consumer Mint/Ting lines may be test endpoints, but MUST NOT be represented as ATLAS carrier infrastructure unless an authorized wholesale/API relationship is evidenced.

## Policy router

Routing considers only VERIFIED/ACTIVE resources and eligible adapters. Inputs may include destination, jurisdiction, voice capability, health, cost, latency, compliance policy, tenant, and failover priority.

No route is produced when:
- carrier credentials are absent/unverified;
- number allocation evidence is absent;
- authorization is missing/expired;
- caller number is not linked to an active atlas_number_resource;
- emergency calling is requested while unsupported;
- policy or tenant authorization fails.

## ATLAS Direct

ATLAS_DIRECT is a reserved provider class, disabled by default. It MUST remain unavailable until the relevant numbering/network authorization is documented and authenticated. Software implementation alone is not carrier authorization.

## iPhone pilot

The pilot has two independent tracks:

1. Voice DID/PSTN: search carrier inventory -> reserve/order -> authenticated allocation evidence -> atlas_number_resources -> voice configuration -> controlled E2E call.
2. eSIM: carrier eSIM order -> activation evidence -> install on compatible iPhone -> network verification.

If the provider supports linking the DID/MSISDN to the mobile subscription, that relationship is recorded only after authenticated provider confirmation.

## Security and evidence

- secrets server-side only;
- no service-role or carrier API keys in browser code;
- organization/tenant scope on every mutation;
- RBAC for search, order, activation, release, and audit;
- immutable audit event for every lifecycle transition;
- webhook signature verification and replay protection;
- idempotency keys for provisioning mutations;
- monotonic lifecycle transitions;
- evidence includes provider, provider resource/order ID, observed_at, verification method, and evidence digest;
- redact activation secrets from logs and UI after one-time secure delivery.

## Production gates

Production voice/mobile remains blocked until all applicable gates are green:

1. authorized carrier relationship;
2. production credentials stored in secret manager;
3. authenticated available-number/eSIM inventory query;
4. successful carrier-side order;
5. allocation evidence persisted;
6. number/eSIM authorization linked to the tenant;
7. webhook/readiness verification;
8. controlled E2E test;
9. audit evidence;
10. exact deployment SHA verified.

Until then, UI must say NOT VERIFIED / BLOCKED, never LIVE.

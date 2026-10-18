# ATLAS Communication — Telephony Foundation

Status: implementation foundation only; no production telephony provider is claimed as verified.

## Goal

Add a provider-neutral calling layer to ATLAS Communication and ATLAS Voice so the same ATLAS agent can support inbound and outbound phone workflows without coupling product logic to one CPaaS, SIP carrier, or future ATLAS Wireless transport.

## Architecture

ATLAS Communication
→ Telephony Gateway
→ Call Orchestrator
→ ATLAS Voice
→ IntelligenceRouter
→ CRM / Calendar / Knowledge / Support workflows
→ Audit / RBAC / Consent
→ Provider Adapter

## Fail-closed rule

ATLAS MUST NOT originate or accept a production call unless the selected provider adapter reports state = verified and the requested direction capability is enabled.

A provider is not verified merely because credentials exist. Verification requires a real provider probe and, before production certification, an end-to-end test with authenticated tenant context.

## Required controls

- organization and actor identity required for every call action
- provider-neutral adapter boundary
- explicit purpose attached to outbound calls
- recording disabled unless supported and consent requirements are satisfied
- all provider credentials server-side only
- call lifecycle state persisted and auditable
- no UI state may say connected/completed unless provider evidence confirms it
- external-provider failures remain fail-closed
- emergency calling capability is a separate explicit capability and MUST NOT be inferred from ordinary PSTN connectivity

## Initial lifecycle

draft → queued → dialing → ringing → connected → completed

Terminal error states:

failed / canceled / blocked

## First implementation slice

1. Add provider-neutral telephony contracts.
2. Add readiness verification gate.
3. Keep all providers unverified by default.
4. Next: add server-side persistence + RBAC/audit service.
5. Then: implement one real provider adapter and authenticated readiness probe.
6. Finally: add inbound webhook verification, UI call controls, production canary, and global production verification.

## Production gate

Until a real adapter is configured and verified, ATLAS may display telephony as available for setup, but must present production calling as gated/unavailable. No synthetic success state is allowed.

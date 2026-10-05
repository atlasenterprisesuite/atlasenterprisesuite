# ATLAS TrustPass — Research Hardening Addendum

Date: 2026-10-04  
Status: Research complete for Core Web planning; follow-on architecture items identified  
Repository: `atlasenterprisesuite/atlasenterprisesuite`  
Branch: `spec/atlas-trustpass`

## Purpose

Extend the approved TrustPass design with the highest-value findings from current standards, ATLAS repository evidence, and platform guidance. This addendum does not widen TrustPass into a CAPTCHA-bypass system. External CAPTCHA, MFA, reauthentication, consent, and provider controls remain external boundaries.

## 1. Highest-Priority Finding: Browser Session Custody

The current ATLAS browser session model persists Supabase access and refresh tokens in `localStorage`. The repository already documents that this is not equivalent to an HttpOnly cookie architecture and that successful same-origin script injection could read those tokens.

RFC 10017, OAuth 2.0 for Browser-Based Applications (BCP 212, August 2026), strengthens the case for the repository's already documented target migration. For business, sensitive, and personal-data applications, a Backend-for-Frontend (BFF) architecture is the preferred browser pattern because the backend keeps OAuth tokens out of browser JavaScript and gives the browser only a hardened cookie-based session.

### Decision

TrustPass Core Web must work safely with the current ATLAS session boundary, but it must not claim token-theft resistance that does not exist. A separate high-priority architecture project must migrate browser token custody to a BFF/session-cookie model using:

- `Secure` cookies;
- `HttpOnly` cookies;
- restrictive `SameSite` behavior;
- host-only cookie scope where practical;
- refresh rotation and explicit logout/revocation;
- CSRF defenses appropriate to the selected request pattern;
- existing Supabase RLS/RBAC and active-organization checks preserved end to end.

This BFF migration is deliberately a separate plan because it changes the entire browser session architecture and should not be hidden inside the first TrustPass feature slice.

## 2. WebAuthn Baseline: Level 3 Stable, Level 4 Watch Only

W3C WebAuthn Level 3 became a Recommendation on 2026-08-25. WebAuthn Level 4 is a First Public Working Draft as of 2026-09-15.

### Decision

- Production TrustPass passkey behavior targets WebAuthn Level 3.
- Level 4 is monitored but cannot become a production dependency until its maturity justifies it.
- User verification is required for sensitive step-up.
- The relying-party ID, expected origin, challenge freshness, credential ownership, and action binding are verified server-side.
- WebAuthn success creates TrustPass evidence; it never directly changes RBAC.

## 3. Recovery Is Part of the Security Boundary

NIST SP 800-63B-4 recognizes properly configured syncable authenticators as capable of strong AAL2 use cases and emphasizes replay resistance, phishing resistance, secure sync fabrics, revocation, and recovery controls.

### Decision

TrustPass cannot treat passkey enrollment as complete unless recovery is governed too.

For privileged accounts:

- support more than one independent recovery-capable authenticator;
- prefer a second passkey/security key or TOTP backup rather than SMS-only recovery;
- require recent strong authentication before adding/removing privileged authenticators;
- treat account/authenticator recovery as a security event that can elevate risk;
- prevent removal of the final viable privileged authenticator without an approved replacement/recovery path;
- notify the user about recovery and authenticator changes;
- optionally hold P0 actions for a short, policy-defined period after high-risk recovery events.

## 4. Continuous Trust: Revoke Faster Than Token Expiry

OpenID Shared Signals Framework 1.0 and CAEP 1.0 are final specifications. CAEP defines continuous security events that let receivers attenuate access when session, credential, assurance, or device state changes.

### Decision

TrustPass v1 adopts internal CAEP-like event semantics even before an external Shared Signals adapter is implemented.

Initial internal events:

- `session_revoked`;
- `credential_changed`;
- `assurance_level_changed`;
- `device_compliance_changed`;
- `account_recovery_completed`;
- `privileged_role_changed`.

These events must revoke or attenuate affected grants immediately rather than waiting for their normal TTL.

An external OpenID SSF/CAEP transmitter/receiver adapter is a later integration, not a Core Web dependency.

## 5. Turnstile Is an Edge Signal, Not ATLAS Authorization

Cloudflare requires server-side Siteverify validation for Turnstile. Turnstile tokens expire after five minutes and are single-use.

### Decision

Turnstile may be enabled only for selected anonymous/public high-abuse flows. It remains optional and provider-backed.

A valid Turnstile response can contribute an anti-abuse signal, but it cannot mean:

- authenticated user;
- trusted session;
- correct tenant;
- approved RBAC permission;
- approved P0/P1 action.

If Turnstile is unavailable, TrustPass must report the provider signal as unavailable rather than fabricating success.

## 6. Native Request Integrity

Apple App Attest recommends a randomized one-time server challenge for attestation/assertion exchange to reduce replay. Android Play Integrity recommends binding the verdict to the material request using `requestHash` and validating the same digest server-side.

### Decision

Native attestation remains a request/app-integrity signal, never human identity proof.

- iOS: server nonce + App Attest assertion + server verification + counter/replay checks.
- Android: stable action digest + Play Integrity `requestHash` + server comparison.
- Never place raw sensitive data in request hashes.
- Provider outage never becomes a trusted result.

These adapters belong to a later native phase after Core Web.

## 7. Sender-Constrained Tokens for Non-BFF Clients

RFC 9449 DPoP can sender-constrain OAuth access and refresh tokens to a client-held key and reduce replay value of stolen tokens. DPoP is not, by itself, authentication or authorization.

### Decision

Do not use DPoP as an excuse to keep long-lived browser bearer tokens exposed to JavaScript. Priorities are:

1. BFF for ATLAS browser sessions;
2. DPoP evaluation for native/public API clients where the protocol stack supports it cleanly;
3. keep RBAC, tenant scope, and TrustPass grants independent.

## 8. Shadow Mode Must Be Measurable

TrustPass already specifies shadow mode. Research reinforces that risk scoring should be calibrated with real ATLAS evidence before broad enforcement.

### Required shadow telemetry

- decision count by action class;
- risk-band distribution;
- top reason-code categories;
- silent-pass rate;
- step-up recommendation rate;
- actual passkey success/failure rate;
- fallback rate;
- p50/p95 evaluation latency;
- p50/p95 step-up latency;
- replay detections;
- cross-tenant mismatch detections;
- false-positive review rate;
- temporary holds;
- account-recovery events;
- policy version.

No anonymous dashboard exposes internal scoring weights.

## 9. Core Web Implementation Cut

To keep the first implementation testable and releasable, Core Web includes:

- deterministic risk/policy domain;
- versioned policy model;
- RLS-backed risk/challenge/grant/credential persistence;
- server-side TrustPass API boundary;
- WebAuthn/passkey enrollment and step-up;
- action-bound one-time grants for protected authenticator-management operations;
- internal continuous-revocation events;
- Security Center routes under `/settings/security`;
- shadow mode and observability;
- fail-closed security behavior for replay, grant mismatch, tenant mismatch, challenge mismatch, and P0 audit failure.

Core Web explicitly does not include:

- browser BFF session migration;
- iOS App Attest;
- Android Play Integrity;
- external SSF/CAEP federation;
- broad enforcement across Finance/Payroll/Health/Tax;
- machine-learning scoring.

Those become independent follow-on architecture projects.

## 10. Recommended Delivery Order

1. Core Web TrustPass in shadow mode.
2. Passkey enrollment + authenticator-management step-up enforcement.
3. Browser BFF/session-custody migration.
4. P0 transaction binding for selected ATLAS business actions.
5. Continuous revocation wired into all Identity recovery/session/role changes.
6. Native iOS/Android attestation adapters.
7. Optional OpenID SSF/CAEP federation.
8. Optional DPoP for suitable non-BFF OAuth clients.
9. Only after measured evidence: broader adaptive enforcement and, if justified, anomaly-model signals.

## 11. Completion Truth

Research or source code alone does not make TrustPass operational. Status must advance only with evidence:

`DESIGNED -> IMPLEMENTED -> TESTED -> SHADOW VERIFIED -> ENFORCED -> DEPLOYED -> VERIFIED IN PRODUCTION`

No later state is inferred from an earlier one.

## Primary references

- RFC 10017, OAuth 2.0 for Browser-Based Applications, BCP 212, August 2026.
- W3C Web Authentication Level 3 Recommendation, 2026-08-25.
- W3C Web Authentication Level 4 First Public Working Draft, 2026-09-15.
- NIST SP 800-63-4 / SP 800-63B-4, including Syncable Authenticators.
- OpenID Shared Signals Framework 1.0, final.
- OpenID Continuous Access Evaluation Profile 1.0, final.
- RFC 9449, OAuth 2.0 Demonstrating Proof of Possession.
- Apple Developer, App Attest server validation guidance.
- Android Developers, Play Integrity standard request guidance.
- Cloudflare Developers, Turnstile server-side validation guidance.

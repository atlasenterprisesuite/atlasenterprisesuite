# ATLAS TrustPass — Adaptive Security Beyond CAPTCHA

Date: 2026-10-04  
Status: Approved product direction; written specification awaiting review before implementation planning  
Repository: `atlasenterprisesuite/atlasenterprisesuite`  
Branch: `spec/atlas-trustpass`

## 1. Purpose

ATLAS TrustPass replaces human puzzle challenges inside ATLAS-controlled products with an adaptive, evidence-based trust system.

The product goal is simple:

- legitimate users should usually continue without interruption;
- sensitive actions should receive phishing-resistant step-up verification;
- abusive or automated traffic should be throttled, challenged, or denied based on multiple independent signals;
- no single risk score, device signal, edge provider, or behavioral heuristic is allowed to replace authentication, tenant scope, RBAC, approvals, or audit evidence;
- ATLAS must never claim that an external CAPTCHA, anti-bot control, or provider verification was bypassed or completed automatically.

TrustPass extends existing ATLAS Identity, organization scoping, RBAC, AAL/MFA, audit, Cloudflare, and release-verification controls. It must not create a parallel identity system.

## 2. Current ATLAS Baseline

Current repository evidence already establishes several security invariants that TrustPass must preserve:

- Supabase RLS, organization scoping, RBAC, and MFA/AAL checks are release requirements.
- Privileged mutations already use AAL2 checks in current source.
- Passkeys/biometrics are an approved direction but are not yet verified current-main production behavior.
- Settings/Security remains partial and does not yet provide a final unified passkey/security-management surface.
- Audit structures exist, but new TrustPass decisions require explicit event provenance rather than implicit logging.
- Cloudflare edge controls are defense in depth and must never substitute for application authorization.

TrustPass therefore closes a known platform gap rather than replacing working identity infrastructure.

## 3. External Research Basis

The design follows current standards and platform guidance rather than inventing a proprietary authentication protocol.

### 3.1 WebAuthn Level 3

W3C Web Authentication Level 3 became a Recommendation on 2026-08-25. WebAuthn provides origin-scoped public-key credentials, user-mediated consent, and cryptographic authentication suitable for phishing-resistant sign-in and step-up verification.

ATLAS should use WebAuthn/passkeys as its preferred interactive authenticator for the web.

### 3.2 NIST SP 800-63-4

NIST SP 800-63-4 treats cryptographic phishing-resistant authentication as the preferred high-assurance direction. Passwords and manually entered OTP values are not phishing-resistant. Syncable passkeys can satisfy strong authentication use cases when configured correctly.

ATLAS adopts the following practical interpretation:

- passkeys/WebAuthn are preferred for sensitive operations;
- TOTP is recovery-capable fallback, not equivalent phishing resistance;
- SMS is never the preferred or sole privileged factor;
- risk may increase authentication requirements but must never downgrade a baseline requirement.

### 3.3 Apple App Attest / DeviceCheck

Apple App Attest allows a native app to establish a hardware-backed cryptographic key, attest that the key belongs to a legitimate app instance, and sign later server requests. Apple explicitly recommends server-generated one-time challenges and replay-resistant counters.

For ATLAS iOS, App Attest becomes a device/app-integrity signal. It is not a user identity proof by itself.

### 3.4 Android Play Integrity

Google Play Integrity returns app, device, account, environment, and abuse-related verdicts. Google recommends checking request binding (`requestHash` or nonce), app integrity, and tiered enforcement rather than treating one device verdict as a universal allow/deny flag.

For ATLAS Android, Play Integrity becomes another risk signal. It does not replace ATLAS Identity or RBAC.

### 3.5 Cloudflare anti-abuse controls

Cloudflare can provide edge-layer rate limiting, bot-management signals, and optional Turnstile verification. These remain provider adapters and defense-in-depth signals. TrustPass is the ATLAS policy authority for ATLAS-controlled actions.

No Cloudflare state may be interpreted as application authorization.

## 4. Core Architecture

Canonical request flow:

`CLIENT -> EDGE -> IDENTITY -> TENANT -> TRUSTPASS RISK -> TRUSTPASS POLICY -> STEP-UP IF REQUIRED -> RBAC/APPROVAL -> BUSINESS ACTION -> AUDIT`

TrustPass is split into focused components:

1. **Signal Collector** — normalizes server-observable and provider-supplied trust signals.
2. **Risk Engine** — calculates a bounded risk score and machine-readable reason codes.
3. **Policy Engine** — combines action sensitivity, required assurance, and risk.
4. **Challenge Service** — performs WebAuthn/passkey or fallback step-up.
5. **Trust Grant Service** — issues short-lived, scoped authorization evidence after successful step-up.
6. **Abuse Control** — applies hierarchical rate limits, temporary holds, and anti-replay checks.
7. **Audit/Evidence Adapter** — records decisions, challenge outcomes, policy versions, and enforcement results.
8. **Security Center UI** — exposes user devices/passkeys and authorized administrator diagnostics.

The components share typed contracts but remain independently testable.

## 5. Critical Improvement: Separate Risk From Assurance

A numeric risk score must not become a universal security decision.

TrustPass uses two dimensions:

- **Required assurance**: the minimum authentication level for the requested action.
- **Observed risk**: evidence that may require stronger controls or denial.

Rules:

- risk can escalate an action from silent access to step-up or deny;
- risk can never reduce the action's minimum assurance requirement;
- low risk does not make a privileged mutation safe without its required MFA/passkey/RBAC/approval checks;
- high risk does not automatically mean fraud; it means additional control is required.

## 6. Action Sensitivity Classes

### P0 — Critical

Examples:

- owner/platform-admin elevation;
- changing payout destination or financial settlement configuration;
- rotating or removing privileged authenticators;
- high-impact Health/Tax exports or regulated submissions;
- disabling security controls;
- production secret/identity administration where surfaced through ATLAS.

Minimum policy:

- authenticated session;
- active tenant/organization membership;
- required RBAC permission;
- AAL2 or stronger;
- phishing-resistant passkey/security key where supported;
- recent user verification;
- explicit transaction/action confirmation;
- one-time action-bound trust grant;
- immutable audit event.

No risk score can waive these requirements.

### P1 — Sensitive

Examples:

- payroll changes;
- HR sensitive-record export;
- provider connection authorization;
- financial profile changes;
- bulk customer/employee data export;
- administrator security settings.

Minimum policy:

- authenticated session;
- active tenant;
- RBAC;
- recent step-up when policy or risk requires it;
- short-lived scoped grant;
- audit evidence.

### P2 — Standard mutation

Examples:

- ordinary CRM updates;
- normal project changes;
- routine business-record edits.

Policy:

- authenticated tenant-scoped session and RBAC;
- adaptive step-up on elevated risk;
- server-side rate limits and audit where required by the domain.

### P3 — Low-risk read

Examples:

- non-sensitive dashboard reads;
- ordinary navigation;
- public or low-sensitivity documentation.

Policy:

- silent access when existing authentication/authorization requirements are satisfied;
- step-up only when abuse signals justify it.

## 7. Risk Score and Decision Bands

TrustPass keeps the approved internal score range of `0..100`.

Default bands:

- `0-25 LOW`: silent access if the action's baseline assurance is already satisfied.
- `26-55 MEDIUM`: apply silent server-side checks and optionally require step-up for P1/P2.
- `56-80 HIGH`: require explicit step-up for protected actions; limit or deny suspicious unauthenticated flows.
- `81-100 CRITICAL`: deny or temporarily hold the attempted action, invalidate exposed grants where appropriate, and create security evidence.

These thresholds are defaults, not universal truths. Each policy decision also uses action class and required assurance.

The browser-facing product should not reveal exact scoring weights to anonymous users. Authorized security administrators may see reason categories and calibrated scores.

## 8. Risk Engine v1: Deterministic First

TrustPass v1 uses explicit rules and bounded weights rather than an opaque machine-learning classifier.

Reasons:

- easier auditability;
- predictable tenant behavior;
- lower false-positive risk during initial rollout;
- easier unit and adversarial testing;
- clearer incident investigation;
- no fabricated confidence from insufficient training data.

A later anomaly model may become an additional signal only after ATLAS has enough verified production data and a measured false-positive/false-negative baseline.

Every decision includes:

- `risk_score`;
- `risk_band`;
- `reason_codes[]`;
- `policy_id`;
- `policy_version`;
- `required_assurance`;
- `observed_assurance`;
- `decision`;
- `correlation_id`.

## 9. Trust Signals

TrustPass evaluates multiple independent signals. No single signal is authoritative.

### 9.1 Identity/session signals

- authenticated user;
- session age;
- recent reauthentication age;
- observed AAL;
- authenticator type;
- recent recovery or password change;
- recent privileged role change;
- session revocation status.

### 9.2 Tenant/RBAC context

- active organization resolved server-side;
- membership status;
- role/permission set;
- action allowed by current tenant policy;
- cross-tenant mismatch attempts.

### 9.3 Request integrity

- one-time nonce/challenge;
- request/action digest;
- idempotency key where applicable;
- replay detection;
- CSRF/origin protections;
- unexpected method/content-type/route behavior.

### 9.4 Device/app integrity

Web:

- successful WebAuthn verification;
- known credential/public-key relationship;
- coarse session continuity;
- optional privacy-preserving edge signals.

ATLAS iOS:

- Apple App Attest assertion validity;
- monotonic assertion counter;
- app identifier/environment match;
- device/app key relationship.

ATLAS Android:

- Play Integrity request binding;
- app integrity verdict;
- device integrity tier;
- app access risk where available;
- unusual recent device activity where available.

Native integrity signals are advisory inputs except where a high-value native-only workflow explicitly requires them.

### 9.5 Abuse/traffic signals

- account request velocity;
- organization request velocity;
- device/session velocity;
- IP/network velocity;
- route/action velocity;
- repeated failed step-up;
- repeated account creation or recovery attempts;
- proxy/automation anomalies where an authorized provider supplies evidence;
- suspicious parallel sessions.

Geolocation or IP reputation alone must never be sufficient to permanently lock an account.

## 10. Hierarchical Rate Limiting

Rate limits are enforced across several dimensions simultaneously:

- IP/network;
- session;
- user/account;
- device/app instance where a privacy-preserving identifier exists;
- tenant/organization;
- route;
- action type.

Edge limits protect infrastructure. Server-side limits protect business actions.

A successful edge challenge does not reset application-level abuse counters.

Required behaviors:

- token-bucket or equivalent bounded-window enforcement;
- `Retry-After` for temporary limits where safe;
- exponential cooldown for repeated failed verification;
- no unbounded in-memory production counters;
- security events for sustained abuse;
- bypass only through reviewed internal service identity, never through a hidden client flag.

## 11. WebAuthn / Passkey Step-Up

Passkeys are the preferred TrustPass interactive verifier.

Required properties:

- RP ID bound to the canonical ATLAS relying-party domain;
- cryptographically random server challenge;
- challenge is single-use and expires quickly;
- expected origin verified server-side;
- user verification required for sensitive step-up;
- credential ownership resolved against the authenticated ATLAS user;
- sign counter / authenticator metadata handled according to WebAuthn semantics;
- success creates a TrustPass grant rather than changing RBAC directly.

Privacy default:

- use privacy-preserving WebAuthn configuration;
- do not require device attestation on the open web unless a separately reviewed enterprise policy genuinely requires it;
- do not build a permanent cross-site fingerprint.

## 12. TOTP and Recovery

TOTP remains an independent fallback/recovery factor where necessary, but it is not represented as phishing-resistant.

Privileged accounts should support at least two independent recovery-capable methods, preferably:

- primary passkey/security key;
- secondary passkey/security key or TOTP;
- offline recovery codes stored separately.

Sensitive authenticator-management operations are themselves P0/P1 actions.

Controls:

- adding/removing a privileged authenticator requires recent strong verification;
- recovery events create security notifications and audit evidence;
- recent recovery can raise risk for subsequent high-value actions;
- changing recovery methods may apply a short security hold to P0 actions where operationally acceptable.

## 13. Transaction Binding

Authentication alone does not prove that the user intended a specific high-value mutation.

For P0 actions TrustPass creates an `action_hash` over a canonical representation of the requested mutation, for example:

`SHA-256(action_type + tenant_id + normalized_resource + normalized_change + nonce)`

The step-up challenge and one-time grant are bound to this digest.

If the payload changes after verification, the grant is invalid.

Examples:

- payout destination;
- payroll bank account change;
- privileged role grant;
- destructive security setting change;
- sensitive export scope.

The confirmation UI must summarize the material action in human-readable form before verification.

## 14. Trust Grants

A TrustPass grant is security evidence, not a new user session and not a replacement for RBAC.

Recommended fields:

- `id uuid`;
- `tenant_id uuid/text`;
- `organization_id uuid/text`;
- `user_id uuid`;
- `session_id text`;
- `policy_id text`;
- `policy_version integer`;
- `action_class text`;
- `action_scope text`;
- `action_hash text null`;
- `assurance_level text`;
- `authenticator_method text`;
- `risk_score smallint`;
- `risk_band text`;
- `issued_at timestamptz`;
- `expires_at timestamptz`;
- `consumed_at timestamptz null`;
- `revoked_at timestamptz null`;
- `correlation_id uuid`.

P0 grants are single-use.

P1/P2 grants may be reusable for a short policy-defined window only when bound to the same user, session, organization, and permitted scope.

Browser clients receive only an opaque reference through secure session state or an `HttpOnly`, `Secure`, restrictive-`SameSite` mechanism. Browser JavaScript must not receive a reusable bearer credential containing all authorization power.

## 15. Native App Request Binding

### iOS

For sensitive native requests:

`SERVER NONCE -> APP ATTEST ASSERTION -> SERVER VERIFICATION -> TRUSTPASS SIGNAL`

Assertions bind the app request to an attested key and fresh server challenge. Counter regression or duplicate challenge use is treated as replay/anomaly evidence.

### Android

For sensitive native requests:

`SERVER NONCE/ACTION HASH -> PLAY INTEGRITY REQUEST -> VERIFIED VERDICT -> TRUSTPASS SIGNAL`

The backend validates request binding before consuming integrity verdicts.

Native attestation outages must not silently produce a trusted result.

## 16. Workload and Agent Identity

Human TrustPass grants must not be reused by ATLAS agents, CI, bots, or background jobs.

Machine actors use separate service identity:

- GitHub App/OIDC/workload identity where applicable;
- scoped server credentials;
- tenant and action scopes;
- short-lived tokens;
- explicit approval requirements for actions whose policy demands human consent.

An agent cannot convert its own workload credential into a human passkey grant.

CAPTCHA/MFA/re-authentication controls belonging to external sites remain human/provider boundaries. ATLAS must hand control to the user rather than attempt to defeat them.

## 17. Data Model

Create a TrustPass namespace using existing Supabase conventions and RLS.

### `atlas_trust_policies`

Stores versioned tenant-aware policy overlays.

Core fields:

- `id`;
- `organization_id` nullable only for platform default;
- `policy_key`;
- `version`;
- `action_class`;
- `minimum_assurance`;
- `step_up_max_age_seconds`;
- `grant_ttl_seconds`;
- `is_active`;
- `created_at`;
- `created_by`.

Platform P0 minimums cannot be weakened by tenant overlays.

### `atlas_trust_risk_events`

Append-only decision evidence:

- identity/session references;
- tenant scope;
- route/action;
- score/band;
- reason codes;
- policy version;
- decision;
- correlation ID;
- timestamps.

Do not persist raw biometric data, raw WebAuthn private material, full client fingerprints, or unnecessary request payloads.

### `atlas_trust_challenges`

Short-lived challenge state:

- challenge ID;
- user/session/tenant scope;
- method;
- action hash;
- challenge hash/nonce state;
- expiry;
- attempt count;
- consumed/locked state.

### `atlas_trust_grants`

Stores scoped grant metadata described above.

### `atlas_trusted_devices`

Stores user-visible device/app-key relationships without covert cross-site fingerprinting.

Possible fields:

- user/org scope;
- platform;
- display label;
- public-key or provider key reference where required;
- attestation status category;
- first/last verified timestamps;
- revoked timestamp.

## 18. API Boundary

Prefer a dedicated server/Edge Function boundary rather than direct browser table mutations.

Proposed operations:

### `POST /trust/evaluate`

Input:

- intended action type;
- opaque resource identifier if needed;
- normalized action hash when applicable.

Server derives user, session, organization, permissions context, and observable signals.

Output:

- `allow`;
- `step_up_required`;
- `deny`;
- `temporary_hold`;
- required step-up methods;
- challenge reference when relevant;
- safe reason category.

### `POST /trust/challenge/webauthn/options`

Creates server-side challenge options for the authenticated user/action.

### `POST /trust/challenge/webauthn/verify`

Verifies the WebAuthn response and returns/records a scoped grant.

### `POST /trust/challenge/totp/verify`

Fallback only when policy permits TOTP.

### `POST /trust/grant/consume`

Used server-to-server by protected mutations or encapsulated inside the protected mutation RPC/Edge Function.

P0 business actions should prefer atomic grant-consumption + business mutation semantics to prevent TOCTOU reuse.

## 19. Error Contract

Stable machine-readable codes include:

- `authentication_required`
- `active_organization_required`
- `permission_denied`
- `trust_policy_not_found`
- `trust_step_up_required`
- `trust_challenge_expired`
- `trust_challenge_consumed`
- `trust_challenge_locked`
- `trust_authenticator_not_allowed`
- `trust_webauthn_verification_failed`
- `trust_totp_verification_failed`
- `trust_grant_expired`
- `trust_grant_consumed`
- `trust_grant_revoked`
- `trust_action_mismatch`
- `trust_session_mismatch`
- `trust_tenant_mismatch`
- `trust_rate_limited`
- `trust_replay_detected`
- `trust_native_attestation_unavailable`
- `trust_native_attestation_failed`
- `trust_temporarily_held`
- `trust_denied`

Frontend messages must not reveal detailed anti-abuse scoring logic to anonymous or blocked actors.

## 20. Security Center UI

TrustPass should extend the existing Settings/Security direction rather than create another disconnected dashboard.

Proposed authenticated routes:

- `/settings/security` — canonical user security center;
- `/settings/security/passkeys` — passkeys/security keys;
- `/settings/security/devices` — trusted/recognized ATLAS app devices;
- `/settings/security/sessions` — active sessions and revocation;
- `/settings/security/recovery` — recovery methods/codes;
- `/settings/security/trust` — authorized user-level TrustPass activity summary.

Authorized organization security administrators may receive:

- policy matrix;
- risk/step-up metrics;
- reason-code aggregates;
- temporary blocks/holds;
- device/app-integrity status categories;
- audit links.

The UI uses existing `AtlasShell`, ATLAS design tokens, responsive contracts, and WCAG 2.2 AA requirements.

## 21. Accessibility

TrustPass must be materially more accessible than visual puzzle CAPTCHA systems.

Requirements:

- no visual puzzle is required for ordinary ATLAS verification;
- all controls keyboard reachable;
- semantic labels and status announcements;
- passkey flows preserve platform/browser accessibility;
- reduced motion support;
- no status communicated only by color;
- recovery paths available when a particular biometric modality cannot be used;
- accessible error and retry states;
- no forced audio/visual discrimination task.

## 22. Privacy and Retention

TrustPass uses data minimization by design.

Prohibited:

- storing raw biometric templates;
- covert persistent cross-site fingerprinting;
- storing raw passwords or TOTP secrets in TrustPass event records;
- keeping full request payloads when a digest/reason code is sufficient.

Default retention proposal:

- ephemeral challenge records: delete or redact shortly after expiry/consumption;
- detailed risk decision records: 30 days by default;
- aggregate security metrics: longer-lived without raw identifiers where practical;
- security audit events: 365 days by default unless a domain-specific retention rule requires otherwise;
- device/public-key relationships: until revoked/removed plus a limited audit-retention period.

Retention policy must remain configurable within legal/security constraints.

## 23. Edge Integration

Cloudflare remains an edge shield, not the TrustPass source of truth.

Allowed inputs:

- WAF/rate-limit outcome;
- authorized bot-management classification where available;
- validated Turnstile outcome for selected anonymous/public abuse cases;
- request/network metadata needed for abuse defense.

Rules:

- edge allow != application allow;
- edge challenge success != authenticated user;
- edge failure cannot grant an alternate bypass;
- provider outage is represented explicitly;
- paid/enterprise-only signals are optional adapters, not required for core TrustPass operation.

This keeps the core architecture usable under the ATLAS zero-cost-first policy while allowing stronger provider signals when separately authorized.

## 24. Failure Modes and Fail-Safe Behavior

### Identity unavailable

Protected actions fail closed.

### Risk store unavailable

- P0/P1 protected mutations fail closed or require a conservative strong-auth path according to policy;
- low-risk reads may continue only when ordinary authentication/authorization is already valid and no trust grant is being fabricated.

### WebAuthn unavailable on client

Offer an allowed fallback according to policy. Privileged P0 operations may remain blocked if phishing-resistant authentication is mandatory.

### Apple/Google attestation provider unavailable

Do not treat the device as trusted by default. Degrade according to action policy and available human authentication.

### Cloudflare signal unavailable

Core TrustPass still evaluates application/session/identity signals. Do not claim bot verification succeeded.

### Audit write failure

P0 sensitive mutations fail closed when required audit evidence cannot be written atomically or reliably.

## 25. Shadow Mode Rollout

TrustPass must not begin by blocking production users from a newly calibrated score.

Rollout sequence:

1. **Offline tests** — deterministic fixtures, attack simulations, property tests.
2. **Shadow mode** — compute risk and recommended action but do not enforce new risk-based blocks.
3. **Observe** — measure score distribution, false-positive candidates, latency, step-up frequency, device/platform variance.
4. **Enforce obvious abuse** — replay, invalid grants, brute-force lockouts, impossible tenant/action mismatches.
5. **Enforce adaptive step-up** — P1/P2 high-risk flows.
6. **Enable P0 transaction binding** — strong verification + one-time grants.
7. **Continuous calibration** — version policy changes; compare before/after metrics.

Policy versions are immutable once used for production evidence.

## 26. Observability and Success Metrics

Required metrics:

- silent-pass rate;
- step-up rate by action class;
- passkey success/failure rate;
- fallback rate;
- median/p95 TrustPass decision latency;
- median/p95 step-up latency;
- rate-limit rate;
- replay detection count;
- temporary-hold count;
- false-positive review rate;
- account-recovery security events;
- device/app-integrity failure categories;
- blocked cross-tenant attempts;
- P0 grant mismatch/expiration events.

The goal is not to maximize blocking. The goal is to minimize fraud/abuse while minimizing unnecessary friction for legitimate users.

## 27. Threat Model and Required Tests

### Authentication attacks

- phishing relay;
- credential stuffing;
- password spraying;
- TOTP phishing;
- MFA fatigue;
- authenticator removal/recovery abuse.

### Session/token attacks

- stolen session cookie;
- replayed trust grant;
- grant used by another tenant;
- grant used by another session;
- expired/revoked grant;
- payload modification after step-up;
- concurrent reuse of one-time grant.

### Bot/abuse attacks

- distributed IP rotation;
- rapid account creation;
- automated recovery attempts;
- headless browser traffic;
- high-volume API calls;
- low-and-slow abuse across many accounts.

### Native app attacks

- modified iOS/Android client;
- replayed App Attest assertion;
- reused Play Integrity verdict;
- mismatched app ID/package/signature;
- emulator/risky environment signals;
- provider outage and malformed verdict.

### Tenant/security boundary attacks

- forged organization ID;
- cross-tenant challenge reuse;
- cross-tenant grant reuse;
- role escalation without permission;
- P0 mutation without recent step-up;
- audit suppression attempt.

### Accessibility/resilience

- keyboard-only;
- screen reader;
- reduced motion;
- unsupported biometric;
- lost primary device;
- offline/temporary provider failure;
- mobile/tablet/desktop.

## 28. Implementation Boundaries

TrustPass must reuse or extend existing ATLAS assets before creating new primitives:

- Identity/session handling;
- active-organization resolution;
- RLS and RBAC helpers;
- audit/event infrastructure;
- AtlasShell;
- design tokens;
- accessibility styles;
- Cloudflare release/security contracts;
- existing verification/grant patterns where they can be generalized safely.

The existing Insurance verification grant design is a useful pattern for tenant/user/scope-bound short-lived grants, but TrustPass should not reuse six-digit-code semantics as its primary security mechanism.

## 29. Non-Goals

TrustPass does not:

- bypass third-party CAPTCHA or anti-bot controls;
- automate external MFA without the user's/provider's authorized flow;
- replace ATLAS Identity;
- replace RBAC or approvals;
- turn device integrity into proof of human identity;
- collect biometric templates;
- guarantee that every bot is detectable;
- expose exact anti-abuse weights to attackers;
- allow a tenant administrator to weaken platform P0 minimums.

## 30. Completion Gates

Implementation is not complete until evidence exists for:

`SPEC -> THREAT MODEL -> TESTS -> DATA/RLS -> RISK ENGINE -> POLICY ENGINE -> PASSKEY STEP-UP -> GRANTS -> UI -> ACCESSIBILITY -> SECURITY -> BUILD -> SHADOW MODE -> ENFORCEMENT -> DEPLOY -> PRODUCTION VERIFY`

Production status vocabulary:

- `DESIGNED`
- `IMPLEMENTED`
- `TESTED`
- `SHADOW VERIFIED`
- `ENFORCED`
- `DEPLOYED`
- `VERIFIED IN PRODUCTION`
- `BLOCKED`
- `EXTERNAL DEPENDENCY`

No later state may be claimed without its corresponding evidence.

## 31. Acceptance Criteria

TrustPass is accepted when all of the following are true:

1. Existing ATLAS Identity, active organization, RLS, RBAC, approval, and audit boundaries remain intact.
2. Risk scoring cannot downgrade a minimum assurance policy.
3. P0 actions require strong recent verification and one-time action-bound grants.
4. WebAuthn/passkey verification uses fresh server challenges and validates RP/origin/user binding.
5. TOTP is represented as fallback/recovery rather than phishing-resistant authentication.
6. Grants are tenant-, user-, session-, scope-, expiry-, and where applicable action-bound.
7. High-value action payload changes invalidate prior grants.
8. Replay attempts fail and produce security evidence.
9. Native iOS/Android attestation is treated as a risk signal and request-integrity proof, not user identity.
10. Rate limits exist at edge and server layers without relying only on IP addresses.
11. Anonymous/public anti-bot provider signals are optional adapters and cannot grant application authorization.
12. TrustPass has a shadow-mode rollout and versioned policy calibration path.
13. Security Center exposes user-controlled passkey/device/session management without fake provider states.
14. WCAG 2.2 AA and mobile/tablet/desktop requirements are verified.
15. No raw biometric data or covert persistent cross-site fingerprint is stored.
16. Agent/workload identities cannot reuse human trust grants.
17. External CAPTCHA/MFA boundaries are handed to the user/provider rather than bypassed.
18. Full unit/integration/security tests, dependency audit, typecheck, build, deployment gates, and exact-release production verification pass before `VERIFIED IN PRODUCTION` is claimed.

## 32. Primary References

- W3C, Web Authentication: An API for accessing Public Key Credentials Level 3, Recommendation 2026-08-25.
- NIST SP 800-63-4 / SP 800-63B, Digital Identity Guidelines.
- Apple Developer, DeviceCheck and App Attest documentation.
- Android Developers, Play Integrity API documentation.
- Cloudflare Developers, Turnstile, WAF/rate limiting, and bot-management documentation where separately enabled.

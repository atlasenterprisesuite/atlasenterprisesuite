# ATLAS Identity Passkeys + ATLAS OS Identity Layer — Design

Date: 2026-09-12
Status: Approved design pending implementation plan
Owner: ATLAS Identity / Security
Primary application: `apps/web`
Secondary consumer: ATLAS OS

## 1. Purpose

ATLAS will make passkey-based device authentication the preferred sign-in method on enrolled devices while preserving recovery through existing account authentication. On supported platforms the operating system or credential provider may satisfy the passkey ceremony with Face ID, Touch ID, Windows Hello, Android biometrics, a device PIN, a hardware security key, or another WebAuthn authenticator.

ATLAS must never implement login by capturing or matching a user's face itself. It must not store facial photographs, facial templates, biometric embeddings, liveness images, or raw biometric sensor data for authentication. The authenticator performs user verification locally and ATLAS receives only the cryptographic authentication result through WebAuthn/passkeys.

The design applies to the web product and to ATLAS OS as a shared identity capability rather than two independent authentication systems.

## 2. Existing ATLAS state

The current web application already has an `ATLAS Identity` boundary in `apps/web/src/identity`.

Current behavior:

1. `IdentityPage.tsx` accepts email and password.
2. `atlasSession.ts` exchanges those credentials with Supabase Auth.
3. ATLAS persists the resulting session client-side.
4. ATLAS validates an active organization membership before navigation continues.
5. Authorized application routes remain tenant-scoped and permission-aware.

Existing data and controls that must be reused:

- `public.profiles`
- `public.organizations`
- `public.organization_members`
- `public.identity_permissions`
- `public.identity_role_permissions`
- `public.organization_role_permissions`
- `public.identity_security_events`
- `public.atlas_user_preferences`
- existing RLS, organization boundaries, RBAC and audit conventions

`identity_security_events` is the existing protected ATLAS Identity audit store. `atlas_user_preferences.preferences` is the existing user preference JSON boundary. Passkey credential material remains owned by Supabase Auth and is not duplicated into ATLAS public tables.

## 3. Goals

The implementation must provide:

- passkey-first sign-in on enrolled devices;
- password/account recovery as fallback rather than the default path;
- discoverable-credential sign-in without requiring the user to type an email first when the authenticator supports it;
- passkey enrollment after an already authenticated session;
- passkey listing, renaming and revocation;
- active-organization validation after authentication;
- RBAC enforcement independent from authentication;
- step-up authentication for sensitive operations;
- safe recovery after device loss;
- security event auditing without biometric payloads;
- accessible non-facial alternatives;
- support for ATLAS Web and ATLAS OS through a common identity abstraction;
- a rollout path that can be feature-flagged and reversed without breaking password recovery.

## 4. Non-goals

This design does not:

- build a proprietary facial-recognition engine;
- store biometric data in Supabase, ATLAS databases, browser storage or ATLAS OS application storage;
- replace tenant or RBAC checks with biometric authentication;
- make a passkey equivalent to authorization for financial, payroll or administrative mutations;
- require Face ID specifically;
- remove recovery methods;
- introduce a second passkey credential database;
- claim that a device is permanently trusted merely because it has a passkey;
- make Supabase's experimental passkey API a permanent dependency of every ATLAS module.

## 5. Architectural decision

### 5.1 Preferred approach

Use Supabase Auth passkeys/WebAuthn behind an ATLAS-owned identity abstraction.

Supabase's current passkey capability uses WebAuthn discoverable credentials and supports registration, authentication, listing, renaming and revocation. As of this design date the feature is experimental and requires `@supabase/supabase-js` 2.105.0 or later with explicit passkey opt-in.

Because the provider API is experimental, ATLAS modules must not call it directly. All provider-specific behavior is isolated behind `AtlasIdentityProvider` / `AtlasPasskeyService` boundaries so the backend can later move to a stable Supabase API or an ATLAS-operated WebAuthn service without rewriting Finance, Payroll, Health, Ride, ATLAS OS or other consumers.

### 5.2 Alternatives rejected for the first implementation

**Proprietary WebAuthn server:** offers maximum control but duplicates challenge, credential, attestation and lifecycle infrastructure that Supabase can currently provide. Retain as a future sovereignty option behind the provider abstraction.

**Camera-based facial recognition:** rejected for authentication because it creates unnecessary biometric custody, liveness, spoofing, privacy and regulatory risk while providing weaker phishing resistance than platform passkeys.

## 6. Shared identity architecture

```text
Device authenticator
  -> Passkey / WebAuthn ceremony
  -> AtlasIdentityProvider
  -> Supabase Auth session
  -> ATLAS session boundary
  -> active organization membership
  -> RBAC / permission evaluation
  -> optional step-up policy
  -> ATLAS Web / ATLAS OS / module action
  -> ATLAS security audit
```

Authentication, tenancy, authorization and step-up are separate decisions.

A successful passkey proves control of a registered credential. It does not by itself prove that the user still belongs to an organization or still has permission to execute an action.

## 7. Components and responsibilities

### `AtlasIdentityProvider`

Single identity interface exposed to ATLAS consumers.

Responsibilities:

- current session state;
- password/recovery authentication adapter;
- passkey authentication adapter;
- sign-out and session invalidation hooks;
- provider event normalization;
- identity state transitions;
- provider independence for callers.

### `AtlasPasskeyService`

Passkey-specific interface.

Responsibilities:

- capability detection;
- register;
- sign in;
- list;
- rename;
- revoke;
- normalize WebAuthn/provider errors;
- never expose private-key or biometric material.

### `AtlasIdentityGate`

Post-authentication access boundary.

Responsibilities:

- valid session;
- active organization;
- tenant context;
- required permissions;
- rejection of stale/invalid context;
- safe redirect target resolution.

### `AtlasStepUpAuth`

Fresh strong-authentication boundary for sensitive operations.

Responsibilities:

- determine whether an operation requires step-up;
- require a fresh passkey ceremony or approved equivalent;
- record successful strong-auth time;
- refuse execution when freshness or verification fails;
- return a short-lived proof usable by the authorized operation rather than treating UI state as authorization.

### `AtlasIdentityAudit`

Security event adapter over the existing guarded audit mechanism.

Responsibilities:

- append approved identity security events;
- minimize metadata;
- prohibit biometric payloads;
- associate events with organization/user when available;
- preserve the existing protected audit boundary.

### Identity UI

Includes:

- `IdentityPage` passkey-first entry state;
- enrollment prompt;
- Security Center passkey management;
- recovery entry points;
- explicit loading, cancel, unsupported, expired, denied, error and success states.

## 8. Authentication flows

### 8.1 Existing valid session

```text
Open ATLAS
  -> existing session detected
  -> validate/refresh session
  -> validate active organization
  -> load current authorization context
  -> continue to requested ATLAS destination
```

A valid session should not unnecessarily trigger biometrics on every page load.

### 8.2 Enrolled device / passkey-first login

```text
Open ATLAS Identity
  -> detect WebAuthn capability
  -> offer passkey as primary action
  -> authenticator performs user verification
  -> Supabase verifies WebAuthn assertion
  -> session established
  -> active organization checked
  -> RBAC context loaded
  -> workspace entered
```

The user does not need to type an email before a discoverable passkey ceremony.

### 8.3 First enrollment

```text
Existing account authentication
  -> confirmed authenticated user
  -> active organization validated
  -> user chooses Enable passkey / Face ID
  -> WebAuthn registration ceremony
  -> Supabase Auth stores public credential
  -> ATLAS records security event
  -> ATLAS preference records passkey-first UX preference
```

Enrollment is explicit. ATLAS never silently captures or enrolls biometric identity.

### 8.4 Unsupported or cancelled passkey

```text
Passkey unavailable / user cancels / authenticator fails
  -> remain unauthenticated
  -> show safe, actionable error state
  -> offer another passkey or recovery method
  -> never mark the user signed in based on UI state alone
```

### 8.5 Organization denied after successful passkey

```text
Passkey valid
  -> session valid
  -> no active organization membership
  -> access denied
  -> session handled according to ATLAS identity policy
  -> security event recorded where appropriate
```

Passkey success never bypasses membership status.

## 9. ATLAS OS identity layer

ATLAS OS consumes the same logical `AtlasIdentityProvider` contract while using the platform's native credential APIs or a WebAuthn-capable native bridge appropriate to the OS shell.

The ATLAS OS identity layer applies to:

- OS/application sign-in;
- unlock after suspension or protected re-entry;
- switching ATLAS profiles or organizations;
- Security Center;
- secrets/password vault access;
- ATLAS Pay and banking mutations;
- payroll release;
- privileged settings and RBAC changes;
- protected data access when policy requires reauthentication;
- authorization of high-risk ATLAS Assistant actions;
- installation or alteration of security-critical ATLAS components.

ATLAS OS must not duplicate passkey credential storage. Provider/native APIs remain the credential source of truth while ATLAS stores only its own policy, session, tenant and audit context.

The same user's web and OS experiences share identity semantics but may have separate registered passkeys because passkeys can be device-, authenticator- or sync-provider-specific.

## 10. Relying Party and origin policy

Production WebAuthn configuration should use a stable ATLAS relying party:

- RP display name: `ATLAS Enterprise Suite`
- RP ID: `atlasenterprisesuite.com`
- production origin: `https://www.atlasenterprisesuite.com`

Additional approved HTTPS subdomain origins may be added only when required by deployed ATLAS surfaces and must remain compatible with the RP ID.

The RP ID must be treated as a long-lived security identifier. Changing it after enrollment invalidates existing passkeys for that relying party and would force reenrollment.

Development and test environments must use explicit development origins and must not weaken production origin checks.

## 11. Data ownership

### Supabase Auth owns

- passkey public credential records;
- passkey identifier;
- provider friendly name;
- registration timestamp;
- provider-maintained last-used timestamp;
- WebAuthn challenge lifecycle;
- passkey verification result;
- resulting authentication session.

### ATLAS owns

Existing `atlas_user_preferences.preferences` may store non-sensitive UX/security preferences, for example:

```json
{
  "identity": {
    "preferred_authentication": "passkey",
    "prompt_passkey_first": true,
    "password_fallback": true
  }
}
```

No passkey public key, private key, attestation blob or biometric representation is copied into this JSON.

Existing `identity_security_events` remains the ATLAS identity audit store.

No new `identity_passkeys` public table is required for the first implementation.

## 12. Audit events

The implementation should use stable event names such as:

- `identity.passkey.enrolled`
- `identity.passkey.sign_in.success`
- `identity.passkey.sign_in.failed`
- `identity.passkey.renamed`
- `identity.passkey.revoked`
- `identity.password.fallback`
- `identity.session.created`
- `identity.session.revoked`
- `identity.step_up.requested`
- `identity.step_up.success`
- `identity.step_up.failed`
- `identity.organization.denied`
- `identity.permission.denied`

Audit metadata may include provider-safe identifiers, organization ID, action category, result code, coarse client context and timestamps as allowed by ATLAS privacy policy. It must never contain face images, biometric templates, private keys, raw authenticator responses beyond what is required by the authentication provider, passwords, refresh tokens or recovery secrets.

## 13. Step-up authentication

Authentication freshness is independent from ordinary session validity.

ATLAS should maintain a server-verifiable or otherwise tamper-resistant concept equivalent to `last_strong_auth_at` / step-up proof for policy evaluation.

Operations that should be eligible for mandatory step-up include:

- payroll release;
- ATLAS Pay movement or payout approval;
- bank account changes;
- privileged accounting mutations designated high risk;
- organization ownership/admin changes;
- RBAC/security policy modifications;
- API/secret management;
- high-risk ATLAS Assistant executions;
- ATLAS OS security-critical configuration.

The implementation must not rely solely on a browser timestamp or client-side flag to authorize a sensitive mutation. The protected operation must verify the step-up evidence together with normal authorization.

Freshness windows are policy-driven by risk and module, not a single hard-coded global duration.

## 14. Recovery and lost-device handling

Recovery must remain possible without the lost authenticator.

Preferred sequence:

1. try another registered/synced passkey;
2. use the approved account recovery method;
3. authenticate the account;
4. inspect registered passkeys;
5. revoke the lost credential;
6. invalidate relevant sessions when supported by the session architecture;
7. enroll a replacement credential;
8. record security events.

Privileged accounts must not receive a silent administrative biometric bypass. Emergency administrator recovery requires an explicit privileged recovery procedure and full audit evidence.

Deleting a passkey must not delete the ATLAS account.

## 15. Session security

The existing implementation currently persists access and refresh tokens in browser local storage. Passkey implementation must not weaken that state.

A separate security-hardening milestone should evaluate moving web session persistence to a server-assisted model with reduced JavaScript token exposure, for example secure `HttpOnly`, `Secure`, appropriately `SameSite` cookies where compatible with ATLAS architecture.

This hardening is not required to prove the passkey ceremony itself, but production rollout must document the current session threat model and the chosen mitigation path.

Logout, credential revocation and lost-device flows must invalidate sessions to the extent supported by the deployed session model.

## 16. UI states

Identity UX must model real authentication states rather than a fake biometric animation.

Expected states include:

- `checking_session`
- `passkey_available`
- `passkey_prompting`
- `authenticating`
- `verifying_session`
- `verifying_organization`
- `verifying_permissions`
- `authenticated`
- `unsupported`
- `cancelled`
- `expired_challenge`
- `verification_failed`
- `organization_denied`
- `permission_denied`
- `session_expired`
- `recovery_required`

The visual treatment may say `Use Face ID` only when the platform can reasonably present Face ID as the authenticator. The generic product capability remains `Use passkey` / `Use device authentication` so the flow works across platforms and accessibility needs.

## 17. Security Center

Settings -> Security -> Passkeys & Devices should expose real provider-backed passkey management:

- list current user's passkeys;
- friendly name;
- created timestamp;
- last-used timestamp when available;
- rename;
- revoke;
- enroll another passkey;
- access recovery guidance;
- display security consequences of revocation.

An ATLAS device inventory may later be broader than a passkey inventory, but the first implementation must not claim that a passkey record is a complete device-management record.

## 18. Accessibility

Facial biometrics are never mandatory.

Equivalent authentication paths must support, where available:

- Touch ID or fingerprint;
- device PIN;
- Windows Hello;
- Android device credential;
- hardware security key;
- another passkey provider;
- approved password/account recovery.

Identity screens must support keyboard navigation, visible focus, screen readers, clear status announcements, reduced-motion preferences, sufficient contrast and understandable recovery/error messages.

## 19. Threat model and mandatory failure cases

Implementation and QA must explicitly exercise:

- stolen or lost device;
- revoked passkey;
- expired challenge;
- replayed WebAuthn assertion;
- wrong RP/origin;
- tampered assertion;
- user cancellation;
- unsupported browser/authenticator;
- session expiration;
- user removed from organization after prior authentication;
- role/permission downgrade during an existing session;
- cross-tenant access attempt;
- account suspension/banning;
- step-up failure during a sensitive action;
- direct navigation to protected routes;
- recovery without the original device.

## 20. Rollout

### Phase 1 — internal pilot

Use an existing ATLAS feature-flag mechanism to enable passkeys only for internal/authorized pilot users.

Validate enrollment, sign-in, organization gating, revocation, recovery, audit and cross-platform behavior.

### Phase 2 — user opt-in

Offer an explicit `Enable faster secure sign-in` enrollment path. Do not silently enroll users.

### Phase 3 — passkey-first default for enrolled users

When a usable passkey exists, show passkey/device authentication as the primary action while retaining recovery.

### Phase 4 — enterprise policy

Allow tenant policy to express states such as:

- passkeys optional;
- passkeys recommended;
- passkeys required for privileged roles where recovery requirements are satisfied;
- step-up required for configured sensitive operation classes.

Policy enforcement must occur at authoritative authorization boundaries, not only by hiding or showing UI controls.

## 21. Verification strategy

### Unit tests

- capability detection;
- error normalization;
- identity state machine/state transitions;
- safe destination routing;
- organization validation decisions;
- permission decisions;
- step-up policy evaluation;
- audit event mapping.

### Integration tests

- password -> enrollment -> logout -> passkey sign-in;
- passkey -> session -> organization -> authorized workspace;
- revoked passkey rejected;
- valid passkey + inactive membership denied;
- valid passkey + insufficient permission denied;
- expired session recovered or rejected safely;
- cancelled authenticator returns to safe fallback;
- lost credential revoked and unusable;
- sensitive operation blocked without current step-up evidence.

### Platform coverage

At minimum where test infrastructure permits:

- iPhone/Safari with platform passkey user verification;
- macOS/Safari;
- Android/Chrome;
- Windows/Edge/Windows Hello;
- Chrome desktop;
- Safari desktop;
- device without biometrics;
- security key;
- synced/password-manager passkey.

Automated tests may mock browser WebAuthn boundaries for deterministic CI, but production-readiness verification must include real authenticator ceremonies on representative platforms.

## 22. Production readiness gates

ATLAS must not claim this feature is production-ready until evidence demonstrates:

1. real WebAuthn challenge/ceremony/verification is in use;
2. no ATLAS code stores biometric material;
3. passkey enrollment, sign-in, listing, rename and revocation work;
4. recovery works when the original device is unavailable;
5. active organization is checked after authentication;
6. tenant isolation remains intact;
7. RBAC remains enforced at authoritative boundaries;
8. sensitive mutations requiring step-up verify fresh evidence;
9. identity security events are recorded without secrets/biometrics;
10. wrong origin, replay, expired challenge and revoked credential fail safely;
11. password/recovery fallback still works;
12. desktop, tablet and mobile layouts expose usable states;
13. keyboard and screen-reader paths are usable;
14. `npm run typecheck`, `npm test` and `npm run build` pass for the implementation branch;
15. affected routes do not produce 404/500 errors;
16. no production provider state is labeled active unless verified against the real provider;
17. ATLAS OS consumes the same identity semantics and does not introduce a duplicate credential store.

## 23. Provider configuration dependency

Hosted Supabase passkey authentication must be enabled and configured before real production passkey ceremonies can succeed.

Required provider settings include:

- passkeys enabled;
- stable WebAuthn RP display name;
- `atlasenterprisesuite.com` RP ID;
- approved production origin(s);
- compatible client library version and experimental opt-in while Supabase requires it.

Provider configuration is an external dependency boundary. Implementation may proceed behind feature flags before production activation, but no UI may claim live passkey availability until the deployed Supabase project confirms the feature is enabled and a real challenge can be obtained.

## 24. Implementation constraints

- Reuse existing ATLAS Identity, session, organization, RBAC, audit and feature-flag architecture.
- Do not create another repository or standalone identity application.
- Do not create a public passkey credential table unless a later provider migration requires a deliberate new source of truth.
- Do not expose Supabase service/secret keys in web or ATLAS OS client code.
- Keep sensitive administrative passkey APIs server-side.
- Do not use `href="#"`, console-only actions or fake biometric success states.
- Preserve existing working password access as recovery until an explicitly approved future policy changes it.
- Treat Supabase passkey API changes as an adapter concern rather than a suite-wide refactor.

## 25. Design outcome

ATLAS Identity becomes the shared identity layer for ATLAS Web and ATLAS OS:

```text
ATLAS Identity
  |- Passkey / device authentication
  |- Recovery
  |- Session lifecycle
  |- Organization boundary
  |- RBAC
  |- Step-up authentication
  |- Security Center
  `- Audit trail

Consumers
  |- ATLAS Web
  |- ATLAS OS Desktop
  |- ATLAS OS Mobile / Tablet
  |- ATLAS Enterprise modules
  `- high-risk ATLAS Assistant execution
```

The defining security property is that ATLAS verifies cryptographic proof from an authenticator rather than collecting a user's face. Identity, tenancy, permissions and action-level authorization remain independent, auditable gates.

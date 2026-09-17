# ATLAS Blocker Recovery Runbook

Last reviewed: 2026-09-16 UTC
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Canonical branch: `main`
Authoritative Supabase project: `atlas-core` (`ggmanzcgtlrvqfoccgsh`)
Production target: Cloudflare

## Purpose

This runbook records recurring blockers, their observable symptoms, root causes, exact recovery path, and the evidence required before declaring the blocker resolved. It exists to prevent ATLAS from repeatedly rediscovering the same failure modes.

Use this state vocabulary consistently:

- IDEA
- DESIGNED
- IMPLEMENTED
- TESTED
- DEPLOYED
- VERIFIED IN PRODUCTION
- BLOCKED
- EXTERNAL DEPENDENCY
- LOCAL-DEMO DATA

Never promote a state without direct evidence.

## 1. GitHub Actions integration failures

### Symptom

`npm ci`, typecheck, or unit tests pass, but `test:integration` fails and production build does not run.

### Known causes already observed

- stale assertions after legitimate UI changes
- React JSX tests missing explicit `React` imports under the current Vitest transform
- components rendered outside required router context
- identity/authorization gates introducing asynchronous test timing
- ambiguous selectors that expect one matching element when the UI intentionally contains multiple matches
- route exists as a component/API but is not registered in `App.tsx`

### Recovery procedure

1. Run the exact-SHA verification workflow against the current head.
2. Preserve the first failing gate. Do not skip or weaken the gate.
3. Classify failures by common root cause before editing individual tests.
4. Prefer product fixes over test changes when behavior is genuinely broken.
5. When the UI is correct and the test is stale, update the test to assert current user-visible behavior without weakening the functional requirement.
6. For routing failures, verify both route registration and required identity/router context.
7. Re-run focused tests first, then the complete exact-SHA gate.
8. Require green evidence for locked install, security audit, typecheck, unit, integration, production build, and recorded SHA.

### Evidence required

A single workflow run on the exact head SHA with every required step successful.

## 2. GitHub Actions runner assumptions

### Symptom

CI is treated as blocked because a self-hosted runner is unavailable or not assigned.

### Root cause learned

Hosted Ubuntu runners are available for the canonical verification and production-readiness workflows. A self-hosted runner must not be treated as a prerequisite unless a workflow explicitly requires one.

### Recovery procedure

- Inspect the workflow's actual `runs-on` value.
- Inspect the job's assigned runner and executed steps.
- Use `ubuntu-latest`/hosted evidence when the workflow is configured for hosted execution.
- Do not infer runner unavailability from historical incidents.

## 3. Exact-SHA merge gate

### Symptom

A branch appears healthy based on earlier runs, but the current HEAD has changed after fixes or documentation commits.

### Recovery procedure

1. Resolve the current branch HEAD SHA.
2. Find or trigger a verification run for that exact SHA.
3. Ignore green runs for older SHAs when deciding whether to merge.
4. Merge using `expected_head_sha` whenever supported.
5. After merge, resolve the resulting exact `main` SHA and inspect workflows on that SHA.

### Evidence required

- exact branch SHA green before merge
- expected-head merge succeeds
- resulting `main` SHA confirmed after merge

## 4. Cloudflare deployment authorization

### Canonical contract

- GitHub Environment: `production`
- Secret credential: `CLOUDFLARE_API_TOKEN` only
- Account ID: configured once in `wrangler.jsonc` as `account_id`
- Worker: `atlas-enterprise-suite-web`
- Do not create `CF_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` secrets, module-specific tokens, per-Worker tokens, or per-deploy tokens.

The steady-state credential should be a durable Cloudflare Account API Token. During migration, the authorization preflight can recognize the existing user token or the target account-owned token through the same single `CLOUDFLARE_API_TOKEN` secret. This compatibility does not create a second credential namespace.

### Failure classes

- `configuration`: Wrangler account/Worker configuration mismatch, including provider code `7003`.
- `authentication`: malformed, revoked, expired, or invalid token, including provider codes `9109` or `6111`.
- `authorization`: valid token/account but missing required Workers permission, commonly provider code `10000` or HTTP 403.
- `provider`: unexpected Cloudflare API/runtime response after configuration, authentication, and authorization checks.

### Recovery procedure

1. Read `cloudflare_failure_category` and the non-sensitive provider code from the failed GitHub job.
2. Do not rotate or create a new token merely because deployment failed.
3. For `configuration`, verify the canonical `account_id` and Worker name in `wrangler.jsonc`.
4. For `authentication`, repair or intentionally rotate the one canonical `production` secret `CLOUDFLARE_API_TOKEN`; never paste its value into chat, logs, source control, issues, PR comments, or workflow output.
5. For `authorization`, expand the approved Workers permission of the same canonical Cloudflare principal; do not create a second token.
6. For `provider`, preserve the provider response code and retry only after determining whether the failure is transient or configuration-related.
7. Re-run the same failed Cloudflare deployment workflow on the exact intended `main` SHA.
8. Require `verify:all`, successful Wrangler deploy, Worker HTTP probes, and ATLAS Manager evidence before marking production `DEPLOYED` or `VERIFIED IN PRODUCTION`.
9. Treat DNS, Worker Routes, custom-domain mutation, and Cloudflare Access policy changes as separate approved infrastructure changes; they are not reasons to create another deployment token.

### Evidence required

- authorization preflight PASS
- `verify:all` PASS
- Wrangler deploy PASS
- Worker/public shell probes PASS
- ATLAS Manager evidence recording PASS

## 5. Cloudflare Access hiding the public site

### Symptom

Anonymous users visiting `www.atlasenterprisesuite.com` are redirected to Cloudflare Access login.

### Root cause

The commercial website and protected Enterprise App are covered by the same Access boundary.

### Target architecture

Public surface:

- Home
- Product / Modules
- Contact
- Demo
- Terms
- Privacy
- Onboarding entry

Protected Enterprise App:

- authenticated tenant data
- RBAC
- audit
- Approval Center
- ATLAS Assistant privileged actions
- internal operational modules

### Recovery procedure

Change Cloudflare Access/DNS/routing so public commercial routes remain anonymous while authenticated application routes remain protected. Verify from an anonymous session after every policy change.

## 6. Supabase owner bootstrap MFA/AAL2

### Symptom

`atlas_bootstrap_owner` is `SECURITY DEFINER` and allows privileged owner bootstrap without requiring MFA assurance level 2.

### Remediation already implemented

Canonical migration:

`supabase/migrations/20260913_harden_atlas_bootstrap_owner_aal2.sql`

Production migration record:

`harden_atlas_bootstrap_owner_aal2`

The effective production function must contain:

- `coalesce(auth.jwt()->>'aal','aal1') <> 'aal2'`
- exception `mfa_aal2_required`

### Recovery / verification procedure

Read `pg_get_functiondef(public.atlas_bootstrap_owner...)` from authoritative production and verify the AAL2 guard is present. Do not rely only on migration source.

## 7. Privileged admin MFA enrollment

### Symptom

Security posture reports enabled platform admins but zero verified MFA enrollments.

### Current known boundary

The database can enforce AAL2, but it cannot create or verify the human's MFA factor on the user's behalf.

### Recovery procedure

The privileged administrator must enroll and verify MFA in the authenticated account. After enrollment, re-run the privileged MFA posture query and require verified count >= 1 for the active platform admin population.

### State rule

Until human MFA enrollment is verified, privileged identity readiness remains BLOCKED even if the database AAL2 guard is correct.

## 8. Supabase SECURITY DEFINER warnings

### Symptom

Security Advisor reports authenticated users can execute 13 `SECURITY DEFINER` RPCs.

### Important lesson

A linter warning is not automatically a vulnerability. Do not convert functions to `SECURITY INVOKER` or revoke execution solely to silence the advisor if the RPC intentionally performs guarded privileged work.

### Verified guard patterns

The current RPC family uses combinations of:

- `auth.uid()` authentication checks
- `auth.jwt()` / AAL2 checks for privileged mutation
- active organization membership
- role/permission evaluation via `has_identity_permission`
- platform-admin checks for platform provisioning/bootstrap
- confirmed-email and token ownership checks for invitation acceptance
- fixed `search_path`

The read RPCs `list_identity_invitations`, `list_identity_members`, and `list_identity_security_events` delegate authorization to `has_identity_permission`, which evaluates active membership for `auth.uid()` and the required role permission.

`accept_identity_invitation` intentionally does not require AAL2; it validates authenticated identity, confirmed email, token validity/status/expiry, exact invitation-email match, organization state, and duplicate membership before creating membership.

### Recovery procedure

For every future SECURITY DEFINER warning:

1. inspect the effective production function definition
2. inspect who has EXECUTE
3. confirm fixed `search_path`
4. identify the internal auth/RBAC/ownership guard
5. confirm tenant scope
6. confirm mutation sensitivity and whether AAL2 is required
7. only then decide among intentional exposure, additional guard, REVOKE, wrapper RPC, or SECURITY INVOKER

Do not mass-change this class of functions.

## 9. Supabase leaked-password protection

### Symptom

Security Advisor reports `Leaked Password Protection Disabled`.

### Constraint

Supabase documents leaked-password protection as a Pro-plan-or-higher Auth feature. The current database connector does not expose an Auth-settings mutation for this control.

### Recovery procedure

Use Supabase Dashboard Auth password/security settings for the authoritative `atlas-core` project and enable leaked-password protection if the project plan supports it. Re-run the Security Advisor afterward and require the warning to disappear.

## 10. GitHub main branch protection

### Symptom

`main` reports `protected: false` and required status checks are off.

### Current ruleset observation

Repository ruleset `Copilot` is active but only configures Copilot code review; it does not enforce pull-request-only changes or required CI status checks.

### Integration constraint

The installed GitHub integration does not have repository administration access to branch-protection endpoints; direct protection access returns HTTP 403.

### Recovery procedure

A repository administrator must create or update protection/rulesets for `main` to require the canonical CI checks and prevent direct unsafe changes. Afterward, verify through repository branch/ruleset metadata rather than relying on the UI alone.

## 11. Performance Advisor warnings

### Current classes

- unindexed foreign keys
- RLS auth initialization-plan warnings
- unused-index findings

### Rules

- RLS `auth.<function>()` init-plan warnings can generally be addressed by using `(select auth.<function>())` where semantically equivalent, with regression tests.
- Add missing FK indexes based on table size, write load, delete/update patterns, and query/workload evidence; do not indiscriminately create every suggested index in one production mutation.
- Never mass-delete indexes because the advisor labels them unused. Usage counters may be reset or workloads may not yet have exercised the index.

## 12. Email-derived incident intelligence

Technical emails from GitHub, Cloudflare, Supabase, DNS, auth providers, and deployment vendors are operational evidence. For each actionable message, capture:

- provider
- subject/date
- failing layer
- error or rejection
- likely root cause
- what ATLAS expected
- what actually happened
- corrective action
- whether recurrence prevention belongs in this runbook

Do not assume an email means the provider is wrong; compare it with the actual workflow, configuration, and runtime evidence.

## 13. Universal incident loop

For every blocker:

1. Observe exact symptom.
2. Resolve exact current SHA/environment/provider.
3. Collect primary evidence.
4. Classify root cause.
5. Apply the smallest reversible correction.
6. Re-run the same failing gate.
7. Verify downstream gates were reached.
8. Record evidence and update this runbook when the failure mode is reusable.
9. Mark human-only, credential-only, billing-only, or provider-only dependencies explicitly instead of stalling unrelated work.

## Current known human-only / external blockers

At the time of this runbook review:

- Cloudflare: the one canonical `CLOUDFLARE_API_TOKEN` must have the approved Workers authorization in the target account; ordinary deployments must not create additional tokens or secrets.
- privileged platform-admin MFA enrollment/verification
- GitHub administrative branch/ruleset protection for `main`
- Supabase leaked-password protection if enabled by the current Supabase plan
- Cloudflare Access policy separation for anonymous commercial pages versus protected Enterprise App

These blockers must not stop independent repository, database review, documentation, test, and convergence work that can safely continue.

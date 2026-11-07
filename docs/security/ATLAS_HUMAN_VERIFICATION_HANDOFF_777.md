# ATLAS 777 — Human verification handoff (isolated foundation)

**Status: DRAFT / P0 NO-GO / no production integration.**

## Existing components reused

- `packages/execution/src/browser-executor.ts`: provider-neutral `waiting_human` browser result and safe result sanitation.
- `packages/execution/src/browser-envelope.ts`: workflow, step, tenant, organization, domain, action and expiry policy.
- `packages/execution/src/approvals.ts`: canonical SHA-256 digest binding an action to its hold.
- Existing ATLAS Manager authorization, RLS and audit infrastructure must own any persistent implementation.

## Authorized flow

1. A browser adapter reports `waiting_human` or a recognized security challenge. ATLAS creates a 30-minute (maximum) hold bound to the action digest and existing envelope. It stores no browser value, cookie, screenshot, password or CAPTCHA answer.
2. ATLAS stops **only** the affected workflow step, saves the hold in tenant-isolated durable storage, and offers the user an official provider sign-in path. Do not click, decode, proxy or solve CAPTCHA challenges for the user.
3. The user may complete the provider's verification manually in an authorized browser. A user's statement or click **never** changes the hold to verified.
4. A trusted **server-side** adapter rechecks the provider session and issues scoped evidence with a checked timestamp. A fresh trusted actor/tenant authorization check and revalidation of the execution envelope are mandatory.
5. The existing tenant-aware durable hold store atomically consumes the hold with a compare-and-set operation; replays/concurrent resumes must fail. The gate returns `ready_for_policy_revalidation`, NOT `completed` or permission to execute. The regular action policy and approved browser executor MUST recheck just before any action.
6. If the provider does not allow session reuse across browsers (e.g. remote browser challenge), this flow remains blocked. Use provider-supported integrations or an explicitly user-controlled browser; never try fingerprint manipulation, CAPTCHA solving, cookie extraction, or anti-bot bypass.

## Production blockers (P0)

- Wire the gate into the actual browser runtime and persisted workflow state; no production caller yet.
- Implement an authenticated tenant-scoped, RLS-protected hold store with atomic consumption and append-only audit evidence; the module only defines callbacks.
- Implement a trusted provider session verifier (not client-supplied evidence), revocation checks, approved status notification, and operator reauthorization.
- Real-browser test coverage for MFA/challenge, timeout, revocation, concurrency, cross-tenant, network loss and resumed action. Enforce exact-HEAD CI, independent security review, and no merge/deploy before gates pass.

## Negative tests

`tests/unit/human-verification-handoff.test.ts` covers challenge detection, no-sensitive-data hold, actor authorization, provider proof, action digest, tenant isolation, expiry, replay/store refusal and dependency failure.

A challenge **must never** be interpreted as permission to send a job application, change a profile or skip verification. Any such external mutation requires its normal per-action authorization and evidence.

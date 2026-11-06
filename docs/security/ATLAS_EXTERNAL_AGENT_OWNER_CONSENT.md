# ATLAS External Agent Owner Consent — 777 REVIEW

Status: **proposed security contract — not a live integration**.
Owner: ATLAS Identity / Security Council. Execution: existing ATLAS Intelligence Core + Universal Execution Approval Center. No parallel permission system.

## Owner authorization invariant

**No external agent or provider adapter may authenticate to an account, inspect private records, read private platform data, import session cookies, use a token, publish content, or execute a third-party action without verified, explicit authorization from the authenticated ATLAS owner for that exact action.**

A broad chat instruction such as "approved", a trusted agent recommendation, the existence of a connected account, or a previously authorized unrelated action is **not** a transferable grant. A local agent, other AI, delegated provider, or autonomous scheduled worker may propose actions but may not confer owner approval on itself.

A public-data research operation may use only lawful, provider-permitted read-only interfaces. Data publication, private access, account authentication, bulk scraping, bypassing provider restrictions, and session reuse are distinct capabilities and require their own authorization/policy validation.

## Canonical reusable surfaces

- `supabase/functions/atlas-copilot/agentic-core.mjs`: agent tool registry and dispatcher. Register every external provider-backed tool with `external_access`: `{ provider, capability, action }`.
- `supabase/functions/atlas-execution/index.ts`: existing execution approvals and trusted user identity source; link to the canonical Approval Center and approval payload digest/authorization version.
- `supabase/functions/atlas-local-control/index.ts` and `tools/local-agent/lib/browser-cdp.mjs`: do not weaken high-risk `oauth_consent` gating, domain allowlist, secure browser profile, credentials protection, and command audit.
- Audit decisions without raw tokens, cookies, session content or private records.

## Mandatory gate before an external tool handler

1. Verify authenticated principal, active tenant membership, RBAC, and permission at the canonical server boundary.
2. Obtain a **canonical, approved** execution approval for this exact tool, not an approval for a different tool.
3. Read external consent only through a trusted server-side resolver (`resolveExternalConsent`). **Never** accept prompt or request claims as consent evidence. Without a resolver, reject.
4. Match the trusted consent fields: `status=approved`, `source=interactive_owner`, `owner_verified=true`, `tenant_verified=true`, `owner_user_id`, `organization_id`, `approval_id`, `provider`, `capability`, `action`, and the exact SHA-256 `payload_digest` returned by `computeExternalActionDigest`.
5. Verify `expires_at` is in the future and `revoked_at` is empty. Reject missing, stale, mismatched, revoked, fabricated or unverified grants.
6. Persist grant and audit transactions atomically when adding the real consent backend; re-check authorization at execution/claim time, not just queue creation. Revocation must invalidate pending work and ongoing sessions.
7. Enforce provider terms, domain allowlists, per-user rate limits, tenant isolation and data minimization independently of the consent record.

The dispatcher code enforces items 2, 3, 4 and 5 for tools explicitly registered with `external_access`; existing policy/permission enforcement supports item 1. This patch does **not** implement a live trusted consent database resolver, a new UI, any login, a vendor connection, or runtime deployment. Those remain P0 dependencies. These contracts must not be marketed as production-active.

## Owner-facing consent UI acceptance

Show provider/account (without secret), exact capability/action, target resource, requested data classification, retention duration, expiry, and an explicit **Approve** / **Deny** choice. Provide **Revoke** with visible status and audit history. Expiry and revocation must be enforceable by the backend; cancelling a UI dialog or clearing local state alone is not revocation.

## Required proof to promote an adapter

- Negative tests: no grant; missing permission; another tenant/owner/provider/capability/action; stale, revoked or modified grants; changed payload; forged request context; consent-service outage.
- Positive test: real authenticated owner approval issued and validated through canonical Approval Center.
- Agent Reach remains **not connected** until adapter provenance, platform terms, dependency audit, isolation, trusted grant persistence, integration tests, CodeQL, and exact-HEAD CI evidence are verified.
- No merge/deploy when any P0 gate is unresolved. Never record an external action as completed without provider-confirmed, audited evidence.

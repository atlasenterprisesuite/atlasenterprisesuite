# ATLAS model continuity, permissions and recovery

Scope: extend the existing atlas-copilot gateway, conversation store and /assistant controls. No second orchestrator or provider registry.

## Design and acceptance

- Conversation identity belongs to ATLAS, not the provider. Read the latest 50 stored messages and return them in chronological order. This is a bounded recent-context window, not a claim of unlimited memory. Durable older decisions require the existing approved-memory path.
- Apply the router allowlist to explicit selection as well as automatic routing. Prototype property names are invalid reasoning profiles.
- Re-resolve the authenticated principal through the existing server auth path before each interactive provider attempt and before publishing its result or evaluating tool proposals. The organization and user must remain unchanged; revoked intelligence.use blocks completion. Native/detached background execution also rechecks before submission and finalization. This narrows revocation races; it does not make remote execution and authorization an atomic transaction.
- Keep automatic recovery inside verified, policy-allowed candidates; preserve history and avoid adding another user turn during fallback. Explicit provider mode never silently fails over. Permission errors are not retryable provider outages. Existing cost and emergency-budget gates remain authoritative.
- Response language, tone and detail are closed choices in the existing /assistant controls. Choices last for the mounted page session; reload resets them. They are transmitted as client metadata and rendered into instructions from fixed server labels, never arbitrary prompt text. They neither grant permissions nor override an explicit task such as translation.
- No provider API calls, external model evaluations or spend are needed for deterministic contract tests. These tests use controlled provider/HTTP transports; actual provider quality and production readiness remain separate evidence gates.

## Reuse and history gaps

The accessible-history search recovered prior concerns about authenticated production E2E, exact-SHA evidence and failed previews. These are leads, not current proof of failure. The canonical repository AGENTS.md and master execution protocol resolve repository identity: atlasenterprisesuite/atlasenterprisesuite is canonical. Do not transfer historical PR evidence from another repository without verification.

The repository already had switching/fallback tests, approved-memory retrieval, tenant-scoped storage, cost policy and accessibility preferences. This change adds missing boundary checks rather than rebuilding those systems.

## Verification plan

1. Observe negative tests against the unmodified gateway/store.
2. Run the deterministic continuity and existing council-security suites after the fixes.
3. Repeat that run three additional times as requested, retaining each log and its exit code.
4. CI must run complete unit/integration, typecheck and build checks on the PR head; check review/ruleset gates before merge.
5. Deploy through the canonical Cloudflare path and the authorized Supabase function path only after P0 gates pass. Reuse verify-production-p0.mjs and verify-global-production.mjs; validate exact deployed SHA and authenticated assistant behavior. A redirect to Access is not production success.

## Limits

This change does not migrate database schema, persist style preferences across accounts, export all ChatGPT chats, prove live model behavior, or deploy a provider. The current runtime can test a source subset retrieved at a fixed SHA through GitHub; a normal Git clone was unavailable because its gateway required credentials. Full repository checks must be evidenced by CI, not inferred from subset tests.

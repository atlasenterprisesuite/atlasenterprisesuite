# ATLAS Trust Fabric 777 — Know Your Agent (KYA) / Incode TrustGraph

Status: **Phase 1 code proposed for review, not production-integrated**.
Reference: https://www.incode.com/platform/know-your-agent/
TrustGraph reference: https://www.incode.com/platform/trustgraph/

## Reuse, not a second control plane

This change reuses:
- `packages/agent-registry` for registered ATLAS agent identities.
- `packages/governance` for tenant-scoped permissions, approval, and audit redaction.
- `packages/execution/src/policy-fabric.ts` for allow/deny/review decisions.
- Existing execution evidence and human approvals for consequential actions.

The independent `evaluateAgentMandate()` contract provides a vendor-neutral,
fail-closed policy evaluator. No biometric records or identification documents
are stored by this change. There is **no active Incode API connection**.

## Enforcement contract

For agent actions, a trusted server entrypoint MUST:

1. Authenticate the agent with the existing configured credential mechanism.
2. Look up registration from the existing agent registry or trusted persistence.
3. Load a mandate from tenant-isolated, authoritative storage.
4. Verify the mandating principal with a trusted verification provider and
   resolve `principalVerification` and `evidenceRef` on the server.
5. Check revocation in authoritative storage *at action time*.
6. Supply the server-derived `AgentMandateInput`, including action ID, target
   scope and exact charged amount/currency, to `evaluateAtlasPolicy` with
   `requireAgentMandate: true`.
7. Honor deny / approval outcomes before dispatching any capability.
8. Audit the decision and the executed action against the agent, principal,
   mandate ID, request ID and proof reference; redact credentials and PII.

Client flags, AI text, MCP tool parameters and third-party risk response bodies
MUST NOT be accepted as authoritative registration, identity, or mandate truth.

The opt-in `requireAgentMandate` switch exists to avoid silently breaking
legacy non-agent flows. **Not every current entrypoint supplies this switch.**
Wiring all agent-side sensitive actions to a persistent, server-resolved mandate
store is an explicit P0 blocker before a platform-wide enforcement or production
claim. An authenticated token alone is not proof of delegated authority.

## Vendor boundary

Incode KYA proposes agent detection, identity binding, access management,
monitoring, and audit. TrustGraph can augment fraud risk based on connected
institutions. These services are external optional identity/risk providers,
not ATLAS's permission source of truth.

- Incode provisioning, documented KYA endpoints, credentials, commercial terms
  and suitable data processing terms are not available in this change.
- Do not invent REST endpoints or present a configured/connected state.
- Later implement a vendor adapter behind an interface using official API docs.
- Send only minimum necessary personal data, with consent and legal review.
- Fail closed for identity verification required actions if the provider is
  unavailable; support a duly authorized human review path rather than silently
  accepting a weaker identity claim.
- A TrustGraph risk flag is a signal for review, never automatic proof of fraud.

## P0 remaining before production

- Server-persisted mandate issuance, narrowing, rotation, revocation and
  optimistic locking, with tenant/org RLS and full authorization.
- Trusted principal identity verification and tamper-resistant evidence binding.
- Server-side registry truth and enforcement at every relevant MCP/HTTP/execution
  entrypoint; no client-controlled bypass or insecure fallback.
- Replay prevention, idempotency, action-time revocation and concurrent
  in-flight stopping tests.
- Non-forgeable audit evidence, retention, access controls, deletion, and consent.
- Incode sandbox integration and negative tests if the provider is approved.
- Unit tests, typecheck, full CI and exact SHA verification.
- Production E2E verification only after approved merge and deployment.

## Focused tests

```bash
npx vitest run tests/unit/agent-mandates.test.ts
npm run typecheck
npm test
npm run build
```

Only a green CI run for the exact PR head and the remaining runtime work can
justify advancing readiness. Do not merge or deploy solely because the unit
tests pass.

# ATLAS 777 — Manus Orquesta interoperability review

Date: 2026-11-06
Owner: existing `packages/execution` and `apps/atlas-orchestrator`
Decision: **isolated policy increment; external execution P0 NO-GO**
Manus source supplied: `orquesta-ci-template.zip` SHA-256 `497bb81bf895b7c360d11024263bb42967cdbd381e5299c7ba8bac4356c23e1d`

## Evidence received versus claims

The user supplied a summary from Manus describing planner/executor JSON contracts, transient/permanent retries, DLQ, ephemeral WebSocket tickets, Streamlit operations dashboard, and a DLQ replay CLI. In the ATLAS conversation, the **only inspectable file among those deliverables** was `orquesta-ci-template.zip`. Its ZIP CRC integrity check passed.

The archive contains exactly:
- `orquesta-ci-template/.github/workflows/ci.yml`
- `orquesta-ci-template/compose.ci.yml`
- `orquesta-ci-template/Dockerfile.test`
- `orquesta-ci-template/requirements-test.txt`
- `orquesta-ci-template/README.md`

There is no planner/executor source, JSON contract/schema, signed WebSocket implementation, DLQ replay script, dashboard source, or slide content in the provided archive. The `manus-resource://...` link and `/home/ubuntu/` file paths are Manus-local references, not repository artifacts accessible to this review. Claims about those deliverables are **not independently certified**.

## Official provider boundary (verified public documentation on 2026-11-06)

Manus API v2 provides task creation, task details/messages and webhooks. API v1 is deprecated.
- https://open.manus.ai/docs/v2/introduction
- https://open.manus.ai/docs/v2/task.create
- https://open.manus.ai/docs/v2/webhooks-overview
- https://open.manus.ai/docs/v2/open-app

A genuine Manus adapter requires an authorized team/provider credential, allowlisted `api.manus.ai` host, server-owned scoped task envelope, provider task ID, permission+budget preflight, webhook authenticity, state reconciliation, durable idempotency and audit. None of those production capabilities are enabled by this change.

Manus agent execution **must not** be conflated with an unauthenticated `/app/...` link, ChatGPT consumer plan, or a client-supplied execution token.

## Canonical ATLAS ownership (reuse only)

| Concern | Canonical owner | Decision |
| --- | --- | --- |
| Intent -> policy -> execution -> evidence | `packages/execution/src/control-plane-contract.ts` | Reuse; no second orchestrator |
| Tenant-scoped durable task state | `packages/ai-core/src/persistence.ts`, `supabaseRpcPersistence.ts` | Must be authoritative |
| GitHub webhook idempotency | `packages/ai-core/src/githubWebhookPersistence.ts` | Reuse pattern, no claim it covers Manus |
| 777 bounded execution | `scripts/atlas-777-autonomous-executor.mjs` | Keep deny by default for merge/deploy/secret operations |
| Retry vs. manual review policy | `packages/execution/src/retry-policy.ts` | Added pure, deterministic policy with negative tests |
| Dead Letter Queue | Existing execution persistence + future authenticated adapter | **Not implemented**. The pure decision `dead_letter` does not enqueue a message |
| Manus task adapter | `apps/atlas-orchestrator/src/providers/manus-v2.ts` | **Preflight contract implemented; network dispatch, durable claim and API credential flow not enabled** |
| WebSocket ephemeral auth | Existing ATLAS Identity/security layer | **Not verified**; no ticket issuer/revocation code supplied |
| Streamlit dashboard | `/work`, ATLAS Manager and shared observability | Do not duplicate UI with a second dashboard |
| CI orchestration | Existing npm/Vitest/GitHub Actions gates | Do not overwrite with a standalone Python+RabbitMQ pipeline |

## What was implemented in this increment

The pure `planAtlasExecutionRecovery()` helper returns one of `retry_scheduled`, `dead_letter` or `blocked`; it does **not** execute/replay/publish/ACK tasks. It validates trusted actor/task tenant+organization equality, 40-char source SHA and evidence SHA, authorization and bounded attempt/backoff limits. Unknown/security errors block; permanent errors and exhausted transient attempts require manual review.

`tests/unit/atlas-execution-retry-policy.test.ts` verifies bounded exponential backoff, exhausted attempts, rejected permissions, mismatched tenants, invalid evidence and malformed retry parameters.


## 2026-11-06 next increment: Manus API v2 dispatch preflight

The server-only `prepareManusV2Dispatch()` module validates the active execution scope, tenant isolation, authorized permission `execution.delegate.manus`, exactly requested read-only capability, approved source SHA, budget approval, authenticated durable-claim evidence and opt-in execution gate. It prepares a **private** v2 `task.create` request with `clear_connectors: true`, `agent_profile: lite`, and no inherited account connectors, project ID, website target, custom tool permissions or credentials.

Manus API reference: https://open.manus.ai/docs/v2/task.create. The provider documentation states that omitted/empty message connectors can inherit account defaults; `clear_connectors: true` is required to prevent that inheritance. Built-in Manus tools may still exist, so no claim is made that the task is a fully isolated read-only sandbox.

Implementation: `apps/atlas-orchestrator/src/providers/manus-v2.ts`
Negative tests: `tests/unit/manus-v2-dispatch-contract.test.ts`

This is only a **pure request preparation** boundary, intentionally without `fetch`, provider secrets, network calls or active task creation. An upstream boolean `durableClaimVerified` alone does not create an atomic durable claim: it MUST be supplied by a trusted server-side persistence operation, never from client JSON. The real dispatch adapter still needs an authoritative atomic-claim + persist-result/reconcile state machine. API `task.create` does not document an idempotency header, so unsafe automatic repetition of an uncertain POST is prohibited. Provider-side non-execution and connectors restrictions must be verified separately.

P0 remains NO-GO: real Manus authentication, signed webhook validation, external execution authorization, durable DLQ, independent review, E2E and post-deployment verification are outstanding.

## Missing P0 for real integration

1. Inspect the actual JSON contract, task payload schema, DLQ script, WebSocket policy and dashboard files. Reject unexpected tools/capabilities and preserve exact SHA and idempotency lineage.
2. Implement **server-side** provider adapter using authorized Manus API v2 credentials and restricted scopes. No client-side keys or default permission to access files/browsers.
3. Verify signed webhook events with replay protection and atomic store transition; ACK only after durable state transition, never use unverified response status as completion.
4. Add durable DLQ model partitioned by tenant with lease, attempts, encrypted payload refs, original evidence, explicit human approval for replay and audit.
5. Exercise concurrency, duplicate webhook, revocation during execution, poisoned message, provider outage, crash between persist and ACK, timeout, 401/403, 429, payload tampering and recovery after restart. Do not use production queues.
6. Run all required CI on exact PR head SHA; independent review, verified preview and production checks before any merge/deploy.

**No external Manus requests, WebSocket, RabbitMQ, customer data, secrets, DLQ operations or deployments were performed in this change.**

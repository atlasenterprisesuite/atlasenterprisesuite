# ATLAS Self-Healing Core — 777 REVIEW (phase 1)

Status: proposed implementation in review. No production operation certified.

## Reuse
Integrate with existing deploymentControl.ts (verification truth and provider adapters),
ATLAS 777 Runner (evidence ledger), Cloudflare token self-heal (bounded remediation),
global-production-verify.yml (exact-SHA fail-closed verification), and existing
Sentinel observability. Do not introduce a second deployment or security control plane.

## Contract
The pure decision engine in `packages/core/src/selfHealingCore.ts` is deliberately
side-effect-free. It decides eligibility, not execution or recovery success.
Incident input must be created by trusted server-side telemetry and authorization,
not by arbitrary client values. Boolean gate attestations are not sufficient on
their own; an executor must independently validate signed/fresh evidence.

Only transient retry and ephemeral restart are eligible for automated execution,
and only with tenant isolation, P0 clearance, bounded retries, cooldown, complete
audit availability, and exact source SHA. A P0 event or protected action requires
review. Failure to obtain evidence blocks recovery (fail-closed).

## Acceptance gates
1. Unit tests reject missing gates, SHA drift, exhausted retry budgets, malicious
   identity input, and unsafe actions.
2. A separate executor must verify RBAC, RLS, token expiry, idempotency and signed
   evidence, write durable audit entries, and enforce circuit breakers.
3. Integration tests must simulate incidents, permission denial, isolation, queue
   replay, and unsuccessful repair verification.
4. CI/security checks and deployment readiness must pass.
5. Staging proves recovery and rollback with real provider evidence.
6. Production remains blocked until authorized promotion plus exact-SHA,
   runtime health, route E2E and provider verification evidence.

No automatic execution, merge, or deployment is added by this phase.

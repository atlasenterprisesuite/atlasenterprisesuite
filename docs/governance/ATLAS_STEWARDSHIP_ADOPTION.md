# ATLAS Stewardship Governance — Domain Adoption Contract

Date: 2026-10-05  
Status: Wave-one adoption contract  
Scope: ATLAS Enterprise Suite

## Purpose

ATLAS Stewardship Governance adds evidence-backed operational assurance to sensitive actions without replacing ATLAS Identity, tenant isolation, canonical RBAC, Supabase RLS, domain controls, provider readiness, approvals, or audit infrastructure.

The required migration order for any governed action is:

`existing identity -> tenant/org scope -> canonical permission -> risk classification -> purpose -> trusted assurance/evidence -> domain/provider gate -> action -> audit/evidence`

Stewardship is additive. It can narrow authority or require stronger evidence; it cannot create authority that canonical RBAC did not already grant.

## Non-negotiable boundaries

- Do not create a second user, tenant, role, permission, or membership source of truth.
- Do not use Stewardship to bypass `authorize(...)`, RLS, domain authorization, approval, provider, consent, or release gates.
- Do not infer or store religion, ideology, morality, personality, ethnicity, politics, social worth, or a numerical trust/social score.
- Do not accept assurance or evidence supplied directly by an untrusted request as proof.
- Do not place tokens, credentials, private certificates, passwords, recovery material, or other secrets in audit metadata.
- Unknown or missing mandatory evidence for R2/R3 fails closed.
- Domain rules may be stricter than Stewardship defaults, never weaker.

## Risk contract

| Risk | Typical impact | Minimum assurance | Evidence / control expectation |
| --- | --- | --- | --- |
| R0 | Read-only or low-impact inspection | `baseline` | Existing identity, tenant/org scope, canonical permission |
| R1 | Normal reversible state change | `baseline` | R0 controls plus auditable state change |
| R2 | Sensitive state change | `verified` | R1 controls plus policy-specific evidence; approval/provider gates when applicable |
| R3 | Critical, destructive, irreversible, or cross-boundary action | `elevated` | R2 controls plus explicit approval/separation-of-duties when required and fail-closed evidence validation |

A domain may promote an action to a higher risk class. It must not demote a risk classification merely to avoid assurance, approval, evidence, or provider requirements.

## Adoption procedure per action

1. Identify the existing production action or command. Do not create a parallel workflow solely for Stewardship.
2. Confirm the authoritative actor identity and tenant/organization scope already used by the action.
3. Identify the existing canonical permission. If none exists, define the domain permission through the normal ATLAS authorization process before adding Stewardship.
4. Classify the action R0–R3 based on impact and reversibility.
5. Assign a narrow purpose code describing why the authority exists, for example `payroll.approve` or `network.route.manage`.
6. Resolve assurance and evidence from trusted server/control-plane sources. Never derive elevated assurance from browser/request claims.
7. Preserve all existing domain gates, including segregation of duties, consent, provider readiness, transaction limits, or infrastructure controls.
8. Execute only after every mandatory gate passes.
9. Emit non-secret audit/evidence metadata with actor, scope, purpose, risk, assurance, policy decision, evidence references, correlation identifier, action/result, and durable resource identity where available.
10. Add focused allow/deny tests plus regression coverage for the existing ungovened path before merge.

Migration is opt-in per action. An unmigrated flow continues under its existing canonical controls until that action receives its own bounded Stewardship integration. Wave one must not globally block modules solely because they have not yet adopted Stewardship metadata.

## Domain examples

### Finance / Accounting / Payroll

Examples:

- R0: read an authorized ledger or payroll status.
- R1: update a draft invoice or non-final payroll preparation record.
- R2: post a journal entry, approve payroll, or change a sensitive accounting configuration.
- R3: irreversible/high-value disbursement, privileged period-close override, or cross-organization financial control-plane action when the domain classifies it as critical.

Existing accounting permissions, posting rules, approval chains, segregation of duties, transaction limits, immutable histories, and provider/payment readiness remain authoritative.

Example chain:

`Identity -> org scope -> payroll.approve -> R2 -> payroll.approve purpose -> verified assurance + evidence -> payroll approval rules -> approve -> audit/evidence`

### ATLAS Network / Connect

Examples:

- R0: inspect provider/network readiness.
- R1: update a reversible tenant-scoped routing preference.
- R2: change provider configuration, provisioning, or production-affecting routing.
- R3: destructive or multi-tenant control-plane change, critical infrastructure action, or another action the Network domain classifies as irreversible/cross-boundary.

Provider state must remain server-verified. A request claiming a carrier, Telnyx, satellite, DNS, edge, or other provider is ready is not evidence.

Example chain:

`Identity -> org scope -> network permission -> R2/R3 -> bounded network purpose -> verified/elevated assurance -> provider/control-plane readiness -> change -> audit/evidence`

### ATLAS Health

Stewardship never broadens access to health information.

Examples:

- R0: an already-authorized user reads an allowed health status or record view.
- R1: a reversible user-authorized wellness workflow update.
- R2/R3: only when an existing Health workflow already permits a sensitive action and its privacy, consent, authorization, and clinical-safety boundaries are satisfied.

Health privacy, consent, record authorization, RLS and domain safety requirements remain authoritative. Missing consent or access authorization cannot be repaired by a higher Stewardship assurance state.

### ATLAS Security

Examples:

- R0: inspect allowed security posture/status.
- R1: reversible tenant-scoped policy maintenance.
- R2: privileged security configuration or credential/security control change.
- R3: destructive incident action, critical credential/control-plane change, multi-tenant infrastructure action, or another irreversible security operation.

R3 requires elevated assurance plus the explicit approval/control-plane mechanism defined by the Security domain. An AI agent cannot approve its own elevation.

### ATLAS Enterprise Administration

Examples:

- R0: inspect organization configuration.
- R1: ordinary reversible administration within an assigned organization.
- R2: organization-wide sensitive configuration, cross-module automation, or privileged administrative changes.
- R3: critical cross-boundary/destructive platform operation.

Stewardship does not create `admin` permission and does not turn a non-admin into an admin. Canonical permissions remain the prerequisite.

### ATLAS AI / Agents

Agentic tools opt in by adding a bounded Stewardship configuration while preserving the existing tool permission and organization checks.

Rules:

- LOW maps to R0, MEDIUM to R1, HIGH to R2, CRITICAL to R3.
- Explicit Stewardship risk may equal or increase the mapped risk; it may not lower it.
- Request fields such as `assurance`, `evidenceRefs`, or `stewardship` are not trusted proof.
- Trusted assurance/evidence comes from the server-side `resolveStewardshipContext(...)` dependency or a future equivalent approved control-plane source.
- R2/R3 cannot silently succeed from missing trusted assurance.
- HIGH/CRITICAL existing approval rules remain in force.
- R3 cannot be silently self-authorized by an agent.
- Governed audit metadata must use whitelisted non-secret fields.

Example chain:

`Agent identity/context -> organization -> tool permission -> mapped risk -> tool purpose -> trusted Stewardship resolver -> provider/approval gates -> tool handler -> audit/evidence`

## Failure semantics

Expected machine-readable Stewardship denial reasons include:

- `scope_mismatch`
- `permission_denied`
- `purpose_mismatch`
- `assurance_insufficient`
- `evidence_required`
- `approval_required`
- `provider_unverified`

Existing domain/runtime denial reasons, such as agentic `tenant_mismatch` or `approval_invalid`, remain valid where that subsystem already owns the gate. Stewardship must not rewrite an earlier authoritative denial into success.

## Audit metadata contract

The reusable core whitelist is:

```ts
{
  purpose,
  stewardshipRisk,
  assurance,
  policyDecision,
  evidenceRefs,
  correlationId
}
```

Only non-secret evidence identifiers or hashes belong in `evidenceRefs`. Do not place raw evidence payloads, request bodies, tokens, credentials, or authentication material in this structure.

## Verification required for each future domain migration

A future bounded integration is not complete until evidence demonstrates:

1. canonical tenant/organization isolation still passes;
2. canonical permission denial cannot be overridden by Stewardship;
3. the selected risk floor cannot be weakened by request/config input;
4. required assurance/evidence fails closed;
5. approval/provider/domain gates remain authoritative;
6. denied handlers/actions are not executed;
7. audit metadata contains only approved non-secret fields;
8. the domain's existing regression suite passes;
9. typecheck/build and repository CI gates pass;
10. production status is claimed only after the deployed commit is verified and applicable P0 production checks pass.

## Wave-one implementation boundary

Wave one provides the reusable core policy, whitelisted audit metadata, one representative governed Agentic Core integration, and this adoption contract.

It does not migrate every Finance, Payroll, Network, Health, Security, Enterprise, or AI action. Those integrations remain separate bounded changes so each domain can preserve its own authorization, evidence, approval, provider, privacy, safety, and release requirements.

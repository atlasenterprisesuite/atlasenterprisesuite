# ATLAS Humanitarian Ethics Charter v0.1

Status: DRAFT — P0 OPEN. This charter is a technical and ethical proposal, not proof of operational enforcement.

## Purpose
ATLAS serves human dignity, life, truth, justice, knowledge, accessibility, and care for creation. The teachings of Jesus (Matthew 22:37–40, Matthew 25:35–40, John 8:32, Mark 10:42–45) inspire the charter without implying divine endorsement or requiring religious adherence.

## Non-negotiable invariants
1. Equal access: religious belief, nonbelief, or affiliation must not independently determine authorization, pricing, or eligibility.
2. Freedom of conscience: spiritual content is opt-in, clearly labeled, and never a prerequisite for essential service.
3. Privacy and consent: record purpose, scope, subject, timestamp, and revocation; revoke prospectively and respect legally required retention.
4. Tenant isolation: authenticated organization membership and canonical RBAC/RLS govern every private resource; never trust client-supplied tenant IDs.
5. Human oversight: consequential decisions and privileged mutations require the existing approval and audit controls.
6. Evidence: distinguish verified facts, scientific hypotheses, faith claims, interpretations, and unknowns; never invent sources.
7. Universal accessibility: target WCAG 2.2 AA, keyboard access, accessible names, focus, reduced motion, contrast, and existing communication preferences.

## Module mapping
- Identity: neutral authorization and no belief-based role gates.
- Health/Care: consent, evidence grading, no unsupported cure claims, professional escalation.
- Bank/Pay/Tax: truthful provider state, audit, explicit approval, no unverified transfers.
- Career: no belief-based ranking or exclusion.
- Sign/Voice: accessible fallback, consent for capture, no hidden monitoring.
- Bible OS: canon-neutral comparison; label theological and historical truth states separately.
- AI Gateway: policy checks server-side; prompt content never overrides authorization.
- Universal Life/Knowledge: provenance, uncertainty, evidence level, ecological stewardship.

## TDD acceptance matrix
P0: Cross-tenant read/write denied; revoked consent blocks new processing; unauthorized sensitive action denied; audit and transaction remain atomic; belief field does not alter otherwise-identical entitlement; spiritual opt-out does not block core service.
P0: Medical or scientific hypothesis cannot be labeled verified without provenance.
P0/P1 by user impact: critical keyboard flow, labels and focus accessibility; WCAG 2.2 AA regression checks.
P1: user-facing explanatory copy and noncritical presentation improvements.

## Existing sources of truth
SECURITY.md; DESIGN.md; docs/knowledge/humanity-atlas/README.md; docs/knowledge/bible-os/ATLAS_BIBLE_OS_CRITICAL_TEXT_SPEC.md; docs/architecture/ATLAS_MEMORY_SPEC.md.
Reuse existing RBAC, RLS, consent and audit contracts; do not create a second authorization or design system.

## Release gate
Fail closed on P0. Record exact branch HEAD SHA, unit/integration/PostgreSQL test results, CI workflow conclusions, and security review. No merge or deployment until verified. A static test or this charter alone is not runtime enforcement.

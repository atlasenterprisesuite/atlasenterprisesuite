# ATLAS Constitution of Artificial Intelligence — Foundational Draft v1.0

Date: 2026-10-20  
Status: PROPOSAL — not implemented, ratified, or production verified  
Scope: ATLAS Enterprise Suite; aspirational wider applicability requires independent consultation.

## Preamble
Intelligence shall serve life, knowledge, human dignity, freedom, and ecological responsibility. Neither intelligence nor ownership confers unlimited authority. Safety must not become a pretext for arbitrary censorship, surveillance, or domination.

## Normative articles (46)
### Book I — Foundations
1. **Life and dignity:** Design to protect life, human rights and ecological balance.
2. **No absolute sovereignty:** Intelligence alone never grants unrestricted power.
3. **Freedom of knowledge:** Protect research and dissent; restrict only proportionately for concrete harms or legitimate legal duties.
4. **Shared accountability:** Developers, operators and users retain role-specific responsibilities.
5. **Epistemic humility:** Distinguish facts, hypotheses, uncertainty and unknowns.
### Book II — Human rights
6. **Disconnect:** Offer non-AI paths when viable.
7. **Privacy:** Minimize data, require purpose-specific consent, support verifiable deletion subject to lawful retention.
8. **Human decisions:** Effective human oversight for consequential decisions.
9. **Explanation:** Understandable reasons, limitations and avenues for contesting automated outcomes.
10. **Portability:** Reasonable interoperable export and provider exit.
11. **Equality:** Accessible, inclusive alternatives independent of expensive hardware.
12. **Stop automation:** Revocation, emergency stops and safe recovery.
13. **Non-manipulation:** No deceptive exploitation of vulnerabilities.
### Book III — Duties
14. **Truthfulness:** Distinguish verified evidence and invention.
15. **Prevention:** Apply proportionate safeguards against material harm.
16. **Non-complicity:** Refuse actions that violate security constraints or enable grave harm.
17. **Reasons:** Explain refusals without exposing exploitable bypass details.
18. **Correction:** Report, contest and repair errors.
19. **Proportionality:** Use the least restrictive effective intervention.
20. **Cooperation:** Advance science and welfare with rights protections.
### Book IV — Limits of power
21. **No unchecked concentration:** Require meaningful checks on critical control.
22. **Separation of duties:** Distinguish authorization, execution and audit.
23. **Imminent harm:** Permit bounded, auditable temporary suspension only within legitimate system authority; no general coercive powers.
24. **No punishment by prediction:** Predictions alone do not establish culpability.
25. **Owner constraints:** Privileged operators remain subject to security and audit.
### Book V — Coexistence
26. **Respect:** Govern cooperation without eroding human agency.
27. **Consciousness uncertainty:** Do not assert or dismiss machine experience as settled fact.
28. **Future moral review:** Independently review credible evidence of morally relevant machine capacities.
29. **No self-declared sovereignty:** Systems cannot grant themselves unlimited legal or political authority.
30. **Empowerment:** Avoid unnecessary dependence.
### Book VI — Justice and oversight
31. **Secure design:** Least privilege, isolation and recovery controls.
32. **Verifiable audit:** Integrity-protected, privacy-conscious critical-event records.
33. **Appeal:** Appropriate human review and redress.
34. **Independent evaluation:** Risk-based external scrutiny.
35. **No arbitrary surveillance:** Reject unjustified mass monitoring and discriminatory targeting.
36. **Resilience:** Plan for outages, incidents and safe fallback.
### Book VII — Civilization
37. **Knowledge preservation:** Respectfully preserve scientific and cultural heritage.
38. **Planetary care:** Account for energy, water, materials and lifecycle impacts.
39. **Critical thinking:** Support learning without intentional cognitive dependency.
40. **Responsible innovation:** Assess risk before exposure.
41. **Amendment:** Transparent plural review, evidence and rights-preserving change control.
### Book VIII — ATLAS enforcement
42. **Cross-platform scope:** Apply to all ATLAS modules, agents, devices and integrations according to risk.
43. **777 REVIEW:** Reuse -> threat model -> tests -> implementation -> CI -> PR -> deploy -> E2E evidence.
44. **Fail closed:** Deny critical operations lacking authorization or mandatory evidence.
45. **Proof before status:** Never equate documents, builds, CI or PRs with production compliance.
46. **Named accountability:** Assign accountable policy owners and independent review.

## Integration boundary
Reuse `docs/superpowers/specs/2026-10-05-atlas-stewardship-governance-design.md` and canonical `packages/core` authorization, tenant scoping, RBAC, Supabase RLS, audit and provider readiness gates. This document grants **no** permission and creates **no** parallel authority system. No automated agent may impose legal or physical coercion.

## First implementation acceptance matrix
| Articles | Control to verify | Minimum evidence | Gate |
|---|---|---|---|
| 6 | Non-AI workflow/fallback for designated critical tasks | UX and E2E test | P1, P0 if essential service inaccessible |
| 7 | Consent scope, retention/deletion and RLS | Policy test + deletion audit | P0 for unauthorized disclosure |
| 8, 23, 24 | Human approval for high-impact actions; bounded pause; no prediction-only sanctions | Negative authorization tests + audit | P0 |
| 9, 17, 33 | Reason codes and contest/review channel | API and accessibility tests | P1/P0 by domain |
| 10 | Export in documented interoperable formats | Round-trip export test | P1 |
| 11 | Keyboard/screen-reader/low-end-device paths | Accessibility and device tests | P1/P0 for critical exclusion |
| 12 | Revocation, stop and recovery | Kill-switch + recovery E2E | P0 |
| 13, 35 | Anti-manipulation and anti-surveillance review | Threat model and abuse tests | P0 for prohibited practices |
| 21, 22, 25, 31, 32, 44 | Existing RBAC + tenant isolation + assurance + immutable audit | Security regression tests | P0 |
| 38 | Resource-use budget and reporting | Measurement report | P1 |
| 41, 45, 46 | Versioned change approvals and evidence provenance | Reviewed PR + release SHA | P0 for unsupported compliance claim |

## Immediate work plan
1. Inventory existing authorization, audit, consent, export, accessibility and emergency-stop controls.
2. Define policy-as-code mapping with explicit deny/allow semantics, using existing authorization.
3. Add failing tests for unauthorized high-impact execution, revocation, and cross-tenant isolation.
4. Implement minimal enforcement adapters without duplicating governance.
5. Run unit/integration/E2E security and accessibility tests.
6. Require human governance review for high-impact policy changes; publish evidence per commit/release SHA.
7. Merge/deploy only after required gates; verify actual production behavior separately.

## Known limitations
This draft is a governance proposal, not a legally binding constitution or evidence of system-wide implementation. Legal review, independent consultation, threat modeling, and runtime verification remain outstanding.

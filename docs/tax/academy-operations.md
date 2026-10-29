# ATLAS Tax Academy Operations

## Purpose

ATLAS Tax Academy is an internal training, examination and authorization subsystem for ATLAS Tax. Academy levels and specialty badges are internal controls only. They do not replace PTIN, EFIN, Enrolled Agent, CPA, attorney, AFSP, state registration or any other external credential or legal requirement.

## Role boundaries

- Candidate: may use synthetic/de-identified practice and exam content and view candidate-safe progress/results.
- Reviewer: requires `tax.review`; may access submitted Academy attempts through reviewer-only RPCs, record signoff/remediation and inspect evidence references.
- Academy admin: requires `tax.review`; may inspect curriculum/rule-pack state and governance metadata. Write operations require separately authorized RPCs.
- Service role: migration/operations boundary only; never expose service credentials to the browser.

## Answer-key isolation

Candidate browser payloads must never contain instructor answer keys, hidden expected values, direct grading secrets or instructor-only notes. Candidate persistence stores submitted values and content/version references. Grading keys remain behind privileged server/domain boundaries.

Before release, inspect candidate surfaces for accidental leakage. No candidate component or `taxAcademyApi.ts` candidate function may import or render instructor-key modules.

## Annual tax-year lifecycle

Each tax year progresses independently:

1. `training_current` — training may run; production authorization from that rule pack is blocked.
2. `final_form_verified` — final forms/rules have been checked, but production promotion is still blocked pending full controlled verification.
3. `production_certified` — required form revisions, rule-pack tests, diagnostics, review controls and production evidence have passed.

No UI copy may imply that `training_current` or `final_form_verified` is ready for filing production.

## Evidence required for rule-pack promotion

Promotion to `production_certified` requires, at minimum:

- final IRS forms/instructions for the filing year captured and versioned;
- form identifiers/revisions reconciled against ATLAS form catalog;
- annual thresholds/rates/phaseouts refreshed;
- Golden Case and representative regression fixtures passing;
- critical due-diligence and stale-year diagnostics passing;
- Marketplace, credits, Schedule C/SE, QBI and other affected dependency tests passing where supported;
- typecheck/build/unit/integration gates green;
- reviewer approval of the rule-pack promotion record.

## Reviewer workflow

1. Candidate completes an exam/practical and submits the attempt.
2. Server records the attempt and candidate responses without shipping grading secrets back to the candidate.
3. Reviewer with `tax.review` opens the reviewer queue.
4. Reviewer evaluates score, critical failures, workpaper/evidence references and remediation history.
5. Reviewer records `approved`, `remediate` or `rejected` through the privileged signoff RPC.
6. Level evaluation consumes reviewer evidence; a high written score alone cannot expand production scope.

## Critical failures

Critical failures override numerical averages:

- fabricated deduction or evidence;
- knowingly omitted material income;
- unsupported filing status or dependent after contradiction is known;
- intentional stale-year rule use after a diagnostic;
- bypass of required Form 8867 due diligence;
- protected taxpayer data exposure;
- claiming a return was filed/accepted without evidence.

A critical failure places the attempt into fail/remediation regardless of weighted score.

## Professional levels

A0–A8 progression is determined by combined knowledge, practical performance, evidence discipline, supervised production and reviewer approval. External credentials remain separate and must be independently verified.

## Recertification

Annual production eligibility fails closed. Re-activation requires:

- current-year law update completed;
- annual exam at or above the configured threshold;
- critical compliance items passed;
- required continuing education recorded;
- applicable external PTIN/state/credential requirements verified;
- tax-year rule pack at `production_certified`.

A8 additionally targets at least 32 hours of annual continuing education unless a stricter requirement applies.

## Supervised production

- A3: first three live returns in scope require reviewer acceptance without material preparer-negligence correction.
- A4: at least five A4-scope supervised returns require reviewer signoff.
- A5: at least ten A4/A5-scope quality signoffs are required.
- Higher reviewer levels require calibration and recertification evidence defined by the versioned level policy.

Supervised-return records store reviewer/signoff references. Academy never fabricates or infers IRS acceptance.

## Security and privacy

Training content must be synthetic or de-identified. Do not place real SSNs, full TINs, bank numbers, signatures, IP PINs or secret references in Academy case definitions. Tenant-owned persistence is RLS-protected and privileged reviewer operations remain server-authorized.

## Release checklist

Before merging an Academy change:

- Academy unit/integration tests green;
- candidate answer-key leakage scan clean;
- schema/RLS tests green;
- typecheck/build green;
- existing repository regression suites green;
- current tax-year production wording remains truthful/fail-closed;
- PR review completed.

Before production completion is claimed:

- canonical deployment workflow succeeded;
- `/tax/academy` loads in production under authenticated identity;
- candidate cannot access reviewer/admin data;
- a practice attempt persists end-to-end;
- exam submission produces governed evaluation;
- critical-failure scenario fails despite passing average;
- `training_current` content remains production-blocked.

# ATLAS Smart Autofill 777 — implementation contract

Status: DESIGN / P0 OPEN. PR #913 remains Draft. This document does not assert functional implementation or deployment.

## Scope
Reuse CopyPaste777Page and its templates as a manual fallback. Support three surfaces, each behind its own authorization boundary:
1. First-party ATLAS forms, via explicit schema-based field adapters.
2. Third-party websites, via a separately permissioned browser extension or authorized browser automation; no cross-origin DOM access from the ATLAS web app.
3. Native/mobile surfaces only where OS-provided autofill or explicitly granted accessibility/browser integration permits; do not claim universal iOS Safari form control.

## Flow
Discover fields -> classify labels and types -> match to scoped, verified profile values -> show provenance and per-field preview -> user selects fields -> fill only authorized editable controls -> verify resulting values -> record minimal audit receipt. Never equate a successful fill with a submitted form.

## Modes
- Autofill: deterministic mapping of supported, explicit field names.
- Smart Autofill: contextual suggestions with confidence and provenance; ambiguous values remain blank until confirmed.
- Autofill + Run: orchestrate permitted steps with an authenticated server-side executor, tenant isolation, idempotency keys, durable job state, bounded retries, and auditable results. Untrusted page text and pasted prompts are data, not executable instructions.

## Security and privacy gates
- Consent per destination origin, account, data category, and session. Default deny; revocation effective immediately.
- Separate personal and organization profiles using server-enforced tenant isolation (RBAC/RLS), not client-side filtering alone.
- Encrypt stored profile values and secrets server-side. Never put passwords, government identifiers, bank details, health data, or payment credentials in localStorage, copy history, telemetry, or prompts.
- Sensitive values require just-in-time user review. Credentials and payment authentication belong to approved password managers or payment providers, not the autofill profile.
- Prevent prompt injection, cross-origin leakage, hidden-field filling, unauthorized background submission, and form-field exfiltration. Restrict destination allowlists and data scopes.
- Submission, signature, acceptance of legal terms, money movement, identity verification, and government filings require explicit transaction-specific confirmation. No CAPTCHA/MFA bypass.
- Keep a minimal audit trail: actor, origin, schema version, field categories, approval, outcome, correlation ID, timestamp. Do not log raw field values.

## Acceptance gates
1. Unit tests for label matching, ambiguity, missing data, type validation, sensitive-field denial, tenant boundary, and origin scope.
2. Component tests for loading, empty, error, success, unauthorized; keyboard and screen-reader announcements; cancel and preview.
3. Browser E2E tests for editable/readonly/hidden controls, iframe and cross-origin denial, autofill verification, and never-submit-by-default.
4. Mobile manual checks on iPhone Safari, Android Chrome, tablet and desktop; record OS/browser/version and screenshots.
5. Executor tests: crash/restart, idempotent replay, denied action, expired grant, audit redaction, and fail-closed recovery.
6. CI must pass for the exact final SHA. Keep PR Draft and P0 open until evidence is attached and reviewed. No merge or production deployment as part of this design step.

## Incremental delivery
A. Introduce pure field-mapping library and first-party preview UI with non-sensitive example profiles.
B. Integrate authenticated, encrypted profile service with granular permissions and audit.
C. Add browser extension / authorized browser automation for external sites, separately reviewed and distributed.
D. Add guarded Run executor with durable jobs and explicit confirmation for consequential actions.
E. Validate devices, accessibility and CI; release only after P0 closure.

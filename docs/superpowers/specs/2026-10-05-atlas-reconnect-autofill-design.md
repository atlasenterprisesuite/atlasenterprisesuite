# ATLAS Reconnect Autofill — Product & Architecture Design

Date: 2026-10-05
Status: Design approved; written specification awaiting review

## 1. Objective

ATLAS Reconnect Autofill is a local, evidence-backed browser assistant for Florida Reemployment Assistance work-search reporting. Its purpose is to reduce repetitive data entry without creating, guessing, or materially altering work-search facts.

Success means an authenticated user can take verified work-search evidence, convert it into a canonical structured record, fill eligible Reconnect work-search fields locally, review every inserted value, and retain explicit control of the final certification/submission.

The system is an autofill/review assistant, not an autonomous benefits claimant. It must never fabricate contacts, misstate dates, infer unsupported outcomes, or submit a certification on the user's behalf.

## 2. Scope

Initial scope is limited to weekly work-search contact entry in Florida Reconnect.

Supported first-wave sources:

- Indeed application confirmation emails;
- employer/recruiter emails that contain verifiable application/contact facts;
- manually entered evidence supplied by the user;
- future ATLAS evidence adapters that emit the same canonical schema.

Supported destination behavior:

- identify the Reconnect work-search form;
- map canonical work-search fields to page inputs;
- populate only verified values;
- highlight missing required fields;
- prevent duplicate insertion within the current batch;
- stop before any final certification or benefits submission action.

Out of scope for the initial increment:

- logging in to Reconnect;
- storing or handling Reconnect passwords, MFA, passkeys, or security answers;
- bypassing CAPTCHA or anti-automation controls;
- submitting weekly benefit certifications;
- answering eligibility questions for the user;
- inventing five contacts to satisfy a quota;
- scraping private employer data not present in the user's evidence;
- representing job alerts as completed employer contacts unless evidence shows an actual qualifying contact/application.

## 3. Product flow

Primary flow:

Evidence source → Evidence parser → Canonical Work Search Record → Validation Engine → Local Autofill Extension → Reconnect field adapter → User review → User-controlled continuation

Required user-visible states:

- VERIFIED — required factual fields are supported by evidence;
- PARTIAL — some fields are supported, but at least one required destination field is missing;
- OUTSIDE_WEEK — contact date is outside the selected claim week;
- DUPLICATE — equivalent employer/role/date record already exists in the current batch;
- UNSUPPORTED — source does not establish a qualifying work-search contact;
- FILLED — values were inserted into the current page and are awaiting review;
- BLOCKED — destination mapping is unsafe or incomplete, so no autofill occurred.

No state may imply submission, acceptance, eligibility, or payment approval.

## 4. Canonical data model

The canonical record is provider-neutral and destination-neutral.

```ts
export interface WorkSearchRecord {
  id: string;
  claimWeekStart: string; // YYYY-MM-DD
  claimWeekEnd: string;   // YYYY-MM-DD
  contactDate: string;    // YYYY-MM-DD
  contactType: 'employer' | 'agency' | 'website' | 'career_source';
  contactMethod:
    | 'online'
    | 'email'
    | 'telephone'
    | 'in_person'
    | 'fax'
    | 'other';
  employerName: string;
  referralSource?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  websiteUrl?: string;
  emailAddress?: string;
  telephone?: string;
  fax?: string;
  personContacted?: string;
  workType: string;
  jobTitle?: string;
  referenceNumber?: string;
  result: string;
  notes?: string;
  evidence: EvidenceReference[];
  verificationStatus:
    | 'verified'
    | 'partial'
    | 'outside_week'
    | 'duplicate'
    | 'unsupported';
}

export interface EvidenceReference {
  sourceType: 'gmail' | 'manual' | 'file' | 'other';
  sourceId?: string;
  capturedAt: string;
  factPaths: string[];
}
```

The first implementation may use a reduced persisted representation, but the validation and UI contracts must preserve the semantics above.

## 5. Evidence rules

Every populated factual field must be traceable to evidence or explicit user entry.

Examples:

- `contactDate` from an application-submitted confirmation timestamp is supported.
- `jobTitle` from the application confirmation is supported.
- `employerName` from the confirmation is supported.
- `result = Application submitted / pending` is supported only when the source confirms submission.
- `personContacted` must remain blank when no individual is named.
- street address, phone, fax, email, or reference number must remain blank when unavailable unless a reliable source explicitly provides them.

The system must not derive unsupported facts from generic job alerts, recommendation emails, salary alerts, or a later rejection email when the original application date is unknown.

When evidence conflicts, the record is blocked from autofill until the conflict is resolved.

## 6. Week validation

A selected claim week defines an inclusive date window.

Rules:

1. `contactDate` must fall inside the selected claim week before a record can be considered VERIFIED for that week.
2. A later response/rejection date does not replace the original contact/application date.
3. Multiple emails about the same application do not create multiple work-search contacts.
4. Claim-week boundaries are explicit inputs and are never inferred from the current date when Reconnect displays a different week.
5. The extension must show the active claim-week window before filling records.

## 7. Duplicate detection

The initial duplicate fingerprint is normalized:

`claimWeek + contactDate + employerName + jobTitle + referenceNumber?`

Normalization includes case folding, whitespace collapse, common punctuation removal, and URL host normalization where applicable.

Duplicates are never silently dropped. They are marked DUPLICATE and excluded from autofill unless the user reviews evidence showing they are distinct contacts.

## 8. Browser extension architecture

Initial delivery target: Chromium-compatible Manifest V3 extension, designed to run locally on the user's device.

Components:

1. Extension popup — imports/pastes canonical JSON, shows validation status, claim week, and record count.
2. Local validation module — schema validation, week validation, duplicate detection, required-field analysis.
3. Content script — executes only on allowlisted Reconnect pages and performs DOM mapping/fill.
4. Destination adapter — versioned selectors and field-mapping logic isolated from core validation.
5. Review overlay — shows fields filled, fields missing, and blocked records before the user proceeds.
6. Local event log — optional session-only diagnostics without storing credentials or page-sensitive values beyond the active session.

No remote backend is required for the initial extension. This minimizes privacy risk, deployment dependencies, and attack surface.

## 9. Permissions and security

Manifest permissions must be least-privilege.

Required principles:

- host permissions scoped only to the official Reconnect/FloridaCommerce domains needed for the form;
- no `<all_urls>` permission;
- no credential capture;
- no reading password/MFA fields;
- no external script loading;
- no eval/dynamic code execution;
- no third-party analytics by default;
- no persistent storage of imported evidence unless the user explicitly enables local persistence in a later release;
- imported data remains local to the browser session in the first release;
- content scripts must refuse to run on non-allowlisted origins.

If the destination origin or page structure does not match the known adapter, the extension fails closed.

## 10. Reconnect destination adapter

The adapter is the only layer aware of Reconnect DOM details.

Responsibilities:

- detect supported page/version;
- locate work-search form controls;
- map canonical fields to destination fields;
- apply values using browser-native input/change events;
- never click final `Next`, `Submit`, `Certify`, `Acknowledge`, or equivalent certification controls;
- never overwrite a non-empty destination field without explicit user action;
- report mapping confidence and missing selectors.

The adapter should prefer semantic attributes (`name`, `id`, associated labels, accessible names) over brittle positional selectors.

If multiple candidate inputs match a field ambiguously, that field is blocked rather than guessed.

## 11. Autofill behavior

`Fill verified contacts` performs a dry validation pass before changing the page.

Autofill requirements:

1. only VERIFIED records are eligible;
2. records are filled one at a time so errors remain attributable;
3. existing non-empty fields are preserved by default;
4. every inserted value is visually marked for review;
5. missing required values are surfaced, not fabricated;
6. after the last fill, focus returns to the review overlay;
7. the extension does not advance the certification workflow.

A separate `Fill current record` action supports one-record-at-a-time operation when Reconnect requires repeated Add Work Search flows.

## 12. Human-review boundary

The following actions are always user-controlled:

- authentication;
- CAPTCHA/MFA/passkey completion;
- resolving factual conflicts;
- adding unsupported missing facts;
- acknowledging legal statements;
- clicking final Next/Submit/Certify when that action constitutes or advances a benefits certification.

The extension may highlight the relevant control after successful review, but it must not activate it automatically.

## 13. ATLAS integration boundary

The extension consumes canonical records, not Gmail directly.

This creates a stable boundary for multiple producers:

- ChatGPT can generate the canonical JSON from user-authorized evidence;
- ATLAS can later expose an evidence review screen that exports the same schema;
- future connectors can emit records after evidence validation;
- Work/browser automation can reuse the same schema for assisted browser sessions.

The first release does not require ATLAS authentication, Supabase storage, or a cloud API.

A future cloud integration must preserve tenant isolation, explicit authorization, evidence provenance, retention controls, and server-side audit requirements.

## 14. UX

Use ATLAS visual language without interfering with the government page's native semantics.

Popup sections:

- Claim Week
- Evidence Records
- Validation Summary
- Ready to Fill
- Needs Review
- Fill Current Record
- Fill Verified Contacts
- Clear Session Data

Record card fields:

- employer/contact name;
- contact date;
- job title;
- method;
- result;
- verification badge;
- evidence count;
- missing-field warnings.

Required states: loading, verified, partial, blocked, filled, mapping-changed, error, empty.

Accessibility requirements: full keyboard operation, visible focus, semantic buttons/labels, screen-reader status messages, and no color-only status communication.

## 15. Failure behavior

Fail closed when:

- page origin is not allowlisted;
- adapter version is unknown;
- required selectors are ambiguous;
- record schema is invalid;
- claim week is missing;
- record is outside the selected week;
- evidence conflicts;
- destination page appears to be a final certification/submission step rather than a work-search-entry page.

Failure must leave the destination unchanged whenever possible and show a concise reason.

## 16. Privacy and data retention

Initial release stores canonical records in memory/session scope only.

`Clear Session Data` removes imported records and diagnostics immediately.

The extension must never persist:

- Reconnect credentials;
- MFA codes;
- security questions;
- SSN;
- bank/payment data;
- unrelated page content.

If later releases add persistence, it must be opt-in, encrypted where appropriate, scoped to the user/device, and governed by a documented retention policy.

## 17. Testing strategy

Implementation follows TDD.

Required test categories:

- schema validation;
- claim-week boundary tests;
- duplicate fingerprint tests;
- unsupported-source tests;
- evidence-conflict tests;
- required-field/missing-field tests;
- destination-adapter selector tests using fixture HTML;
- non-empty-field preservation tests;
- event-dispatch tests for populated inputs;
- fail-closed tests for unknown page versions/origins;
- tests proving final certification controls are never clicked;
- accessibility tests for popup/review overlay;
- extension manifest permission tests;
- build/package verification.

End-to-end testing must use a safe local/static fixture or authorized test environment. Production interaction must not submit a benefit claim during automated testing.

## 18. Rollout

Phase 1 — canonical schema, validator, duplicate/week checks, local import, and fixture-based adapter tests.

Phase 2 — Manifest V3 extension UI and manual one-record autofill on supported Reconnect work-search pages.

Phase 3 — verified multi-record workflow with review overlay and stronger adapter-version detection.

Phase 4 — optional ATLAS evidence-export integration and Work/browser-assisted flows using the same schema.

Each phase remains usable independently and must not depend on a cloud backend to perform the core local autofill task.

## 19. Non-goals

- replacing FloridaCommerce eligibility rules;
- legal interpretation of whether a specific activity qualifies when evidence is ambiguous;
- autonomous claim submission;
- CAPTCHA bypass;
- credential storage;
- generating fictional employers, contacts, dates, outcomes, addresses, or phone numbers;
- treating automated job recommendations as completed work-search contacts without evidence;
- mass automation against government systems.

## 20. Acceptance criteria

The first production-capable local increment is acceptable when:

1. canonical work-search records are schema validated;
2. each populated factual field is evidence-backed or explicitly user-entered;
3. outside-week and duplicate contacts are blocked from automatic fill;
4. the extension runs only on an explicit official-domain allowlist;
5. unknown/changed destination mappings fail closed;
6. existing non-empty fields are not overwritten by default;
7. missing data remains missing and visible rather than being guessed;
8. the extension can fill a verified work-search record on a representative Reconnect fixture;
9. tests prove it cannot activate final certification/submission controls;
10. imported records are session-local and clearable;
11. accessibility and Manifest V3 security checks pass;
12. the user remains in control of all legal acknowledgments and final claim actions.

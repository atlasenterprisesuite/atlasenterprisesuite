# ATLAS Inclusive Communication Validation Protocol

**Owner:** ATLAS Connect / Inclusive Communication  
**Applies to:** ATLAS Enterprise Suite web surfaces and future native/mobile clients  
**Validation baseline date:** 2026-09-11

## Status vocabulary

- `PASS`: verified with current evidence.
- `FAIL`: verification executed and acceptance criterion failed.
- `PENDING`: implementation or evidence exists but the required validation has not executed successfully.
- `BLOCKED_EXTERNAL`: validation requires a physical device, operating system, provider, participant cohort, credential, or environment not available to the automated repository workflow.
- `NOT_CONFIGURED`: provider/device integration does not exist and must not be represented as active.

A capability is never promoted to production-ready from documentation, a mock, a synthetic score, or an automated scan alone.

## Standards baseline

ATLAS targets **WCAG 2.2 Level AA** as its product engineering baseline. WCAG 2.2 is a W3C Recommendation and adds requirements including Focus Not Obscured (Minimum), Dragging Movements, Target Size (Minimum), Consistent Help, Redundant Entry, and Accessible Authentication (Minimum).

Compliance mappings are tracked separately because laws do not all reference the same WCAG version:

- **United States — ADA Title II web/mobile rule:** WCAG 2.1 Level AA for covered state/local government web content and mobile apps. As of 2026, federal guidance lists compliance dates of April 26, 2027 for entities with population 50,000+ and April 26, 2028 for smaller entities/special districts.
- **United States — Revised Section 508:** incorporates WCAG 2.0 Level A and AA for covered federal ICT.
- **European accessibility baseline:** EN 301 549 V3.2.1 remains the version cited in the Official Journal for the Web Accessibility Directive in ETSI's current work-program record. ETSI has advanced the V4.1.1 revision in 2026; ATLAS must not claim a newer harmonized legal baseline until the applicable citation/adoption is verified.

Automated tools support conformance work but cannot establish complete conformance by themselves. Manual assistive-technology and user validation are mandatory gates.

Primary references:

- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- https://www.deque.com/axe/axe-core/
- https://www.ada.gov/resources/2024-03-08-web-rule/
- https://www.section508.gov/develop/applicability-conformance/
- https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf

---

# Layer 1 — Web Accessibility and Assistive Navigation

## 1.1 Automated audit

**Gate:** `.github/workflows/accessibility-validation.yml`

The pipeline builds the web client, launches the production preview, and runs `@axe-core/cli@4.13.0` with WCAG A/AA tags including WCAG 2.2 against:

- `/`
- `/finance`
- `/health`
- `/settings/accessibility/communication`

**Acceptance criterion:** zero axe violations in the configured WCAG A/AA rules for every audited route.

**Current status:** `PENDING` — workflow is committed, but GitHub-hosted jobs for the current PR are failing before steps begin, so there is not yet valid execution evidence.

Automated findings are necessary but not sufficient. Axe documentation explicitly notes that automated systems cannot test 100% of accessibility conformance.

## 1.2 Keyboard-only validation

Run every test with pointer/touch input unavailable.

Required flow:

1. Reach the global Accessibility launcher using `Tab`.
2. Open the Accessibility Communication Center using keyboard activation.
3. Verify focus moves into the dialog.
4. Traverse every interactive element in logical order.
5. Confirm no focus trap exists outside the intentional modal focus boundary.
6. Confirm `Shift+Tab` wraps correctly within the modal.
7. Close with `Escape` and verify focus returns to the launcher.
8. Navigate to Communication Settings.
9. Change every preference with keyboard only.
10. Navigate away and back; confirm state persistence.

**Acceptance criterion:** no unreachable control, no unintended keyboard trap, no invisible focus, and focus is not obscured by ATLAS-created content.

**Current status:** automated component-level focus behavior is covered by integration tests; complete browser/manual keyboard traversal is `PENDING` until runnable browser validation is available.

## 1.3 Screen-reader matrix

| Platform | Assistive technology | Required flow | Status |
|---|---|---|---|
| iOS | VoiceOver | launcher → modal → capability status → Settings → save | BLOCKED_EXTERNAL |
| macOS | VoiceOver | full desktop keyboard + rotor/landmark navigation | BLOCKED_EXTERNAL |
| Android | TalkBack | launcher → modal → Settings → save | BLOCKED_EXTERNAL |
| Windows | NVDA | landmarks, forms, dialog, live regions, route changes | BLOCKED_EXTERNAL |
| Windows | JAWS | landmarks, forms, dialog, live regions, route changes | BLOCKED_EXTERNAL |

For each run record:

- browser/app version;
- OS version;
- assistive technology version;
- task result;
- incorrect/missing announcement;
- focus order issue;
- duplicated announcement;
- inaccessible control;
- severity and remediation commit.

No screen-reader combination may be marked `PASS` without an actual run on the named technology.

---

# Layer 2 — Confidence Engine and Accessibility Profiles

## 2.1 Confidence thresholds

Required behavior:

- `score >= 0.98`: high confidence; non-sensitive action may proceed automatically.
- `0.74 <= score < 0.98`: medium confidence; explicit user confirmation required.
- `score < 0.74`: automated action blocked; clarification or human-interpreter path offered when a real provider exists.
- sensitive actions: confirmation remains mandatory regardless of confidence; downstream module RBAC/authorization remains authoritative.

Automated coverage: `tests/unit/accessibility-confidence.test.ts` and `tests/integration/atlas-accessibility-shell.test.tsx`.

**Current status:** implementation updated; execution evidence remains `PENDING` while the CI runner does not start job steps.

## 2.2 Profile persistence, tenant isolation, and RBAC boundary

ATLAS reuses `public.atlas_user_preferences` rather than creating a parallel accessibility table.

Verified schema properties on 2026-09-11:

- primary key: `user_id`;
- functional preferences stored in `preferences jsonb`;
- accessibility payload stored under `preferences.accessibilityCommunication`;
- existing unrelated preferences are preserved during merge;
- local storage is cache/fallback only.

Verified RLS policy behavior from the live Supabase schema:

- SELECT is restricted to `user_id = auth.uid()`;
- UPDATE is restricted to the user's own record;
- INSERT requires `user_id = auth.uid()`;
- any `default_org_id` must belong to an active organization membership for the authenticated user.

**Security acceptance criterion:** accessibility preference persistence must never bypass these policies, and accessibility-triggered business actions must still pass the target module's RBAC, tenant, and authorization checks.

**Current status:** schema/RLS inspection `PASS`; end-to-end authenticated browser persistence `PENDING`.

---

# Layer 3 — Hardware and External Devices

## 3.1 Camera / microphone capture

The current milestone does not claim a production ASL recognition provider or live caption provider.

Validation may begin only after a real adapter exists.

Required measurements per device/browser combination:

- camera acquisition success/failure;
- permission-state transition;
- visible camera-active indicator;
- visible microphone-active indicator;
- capture frame rate;
- end-to-end recognition latency;
- dropped-frame rate;
- thermal throttling behavior on mobile;
- provider/network failure behavior;
- confirmation that raw audio/video is not persisted by default.

**Status:** `BLOCKED_EXTERNAL` / provider `NOT_CONFIGURED`.

## 3.2 Refreshable Braille

A preference for Braille output is not proof that hardware is connected.

Test matrix must include, where supported and authorized:

- OS accessibility bridge behavior;
- USB/HID path;
- Bluetooth path;
- browser WebHID/WebBluetooth capability where appropriate;
- line wrapping;
- cursor routing;
- form labels and validation messages;
- live-region/caption updates;
- disconnection and reconnection behavior.

Physical devices must be identified by manufacturer/model/firmware in test evidence.

**Status:** `BLOCKED_EXTERNAL` — no physical refreshable Braille display is attached to the current validation environment.

## 3.3 Haptic patterns

Test actual devices, not only API presence.

Record whether users can reliably distinguish configured patterns for:

- ordinary message;
- confirmation;
- warning;
- emergency/high-priority event.

Haptics must never be the sole carrier of critical information.

**Status:** `BLOCKED_EXTERNAL` for human/device discrimination testing. Browser vibration API presence may be detected separately but does not satisfy this gate.

---

# Layer 4 — Human Validation: Nothing About Us Without Us

ATLAS must include the communities who depend on these functions in product acceptance.

Required participant groups across pilot rounds:

- Deaf native/primary sign-language users;
- hard-of-hearing users;
- blind screen-reader users;
- low-vision users;
- DeafBlind users, including people using tactile/protactile communication where appropriate;
- interpreters and accessibility specialists as supporting participants, not substitutes for disabled users.

## Pilot tasks

Representative end-to-end tasks must include:

- open ATLAS and configure communication preferences;
- complete an HR workflow;
- read and respond to a message;
- complete a form with validation errors;
- receive an urgent notification;
- use a sign-language interaction when that language/provider is genuinely available;
- recover from low-confidence recognition;
- request a human interpreter when a provider is genuinely connected.

## Metrics

Record at minimum:

- sign-recognition accuracy by language, signer cohort, device, lighting, skin-tone range, signing speed, and regional variety;
- correction rate and unrecognized-sign rate;
- end-to-end sign recognition latency;
- avatar start latency and completion latency;
- caption latency and correction rate;
- task-completion success rate;
- time on task;
- abandonment rate;
- human-interpreter escalation success/failure and handoff time;
- accessibility defect severity;
- participant-reported comprehension and confidence.

ATLAS must not set a universal sign-recognition production threshold from engineering preference alone. Language-specific acceptance targets require Deaf-community and linguistic review.

**Status:** `BLOCKED_EXTERNAL` until participant recruitment, consent, test protocol approval, and real language/provider capability exist.

---

# International Sign-Language Validation

Use the term **sign languages / lenguas de señas**: these are natural languages, not a single universal gesture system.

International Sign may be useful in specific cross-border contexts, but it is not a replacement for national/regional sign languages.

ATLAS language rollout must be registry-driven and allow multiple sign languages per country/territory. It must never infer a sign language only from spoken language or country.

Authoritative research order:

1. World Federation of the Deaf (WFD) national association and legal-recognition evidence.
2. National Deaf association / government or language authority.
3. ISO 639-3 language identifier where one exists.
4. Glottolog and the Sign Language Dataset Compendium for linguistic/resource metadata.
5. Deaf-community validation of regional varieties and product terminology.

As of the WFD update dated 18 June 2026, WFD reports 84 of 195 countries with sign-language legislation. Legal recognition does **not** mean ATLAS has sufficient linguistic data, model quality, or community approval to enable automated translation.

The repository's sign-language registry is therefore a provenance-controlled rollout registry, not a claim of universal model support.

---

# Release Gate

ATLAS Inclusive Communication may advance from foundation to production capability only when all applicable gates are supported by evidence:

1. automated WCAG scan executes successfully;
2. focused unit/integration tests execute successfully;
3. keyboard-only critical flows pass;
4. required screen-reader matrix has real results;
5. profile persistence is verified through authenticated RLS flows;
6. any hardware/provider advertised as available has physical/integration evidence;
7. each enabled sign language has language-specific linguistic and Deaf-community validation;
8. human pilot findings have been triaged and critical/high accessibility defects resolved.

A `BLOCKED_EXTERNAL` gate is not a failure, but it prevents claims that the corresponding capability is production-validated.

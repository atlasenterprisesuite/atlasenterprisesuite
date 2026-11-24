# ATLAS Banking Calendar 777 — US holiday impact advisory

Date: 2026-11-23
Status: Branch implementation; not production verified.
Canonical path: `@atlas/core` and the existing `/work/os` page. No shadow payment system.

## Sources and provenance

- Federal Reserve Financial Services, official 2026 and 2027 holiday schedules and FedACH processing:
  https://www.frbservices.org/about/holiday-schedules/
- Chime Team, *Chime's 2026 Holiday Schedule*, published 2026-06-30:
  https://www.chime.com/blog/chime-holiday-bank-schedule/

Provider source policies are never silently substituted for Federal Reserve policy or vice versa. Chime's published 2026 table does **not** list Independence Day, even though the Fed table lists July 4, 2026. July 4 is a Saturday; the Chime reference returns a weekend restriction without inventing a Chime-specific holiday entry. Other financial institutions may have distinct processing rules.

## Scope

- A deterministic read-only `getBankingCalendarDay(date, source)` returns a source, URL, date, classification, basis, holiday name, and `advisoryOnly: true`.
- `nextBankingBusinessDay(afterDate, source)` scans only the published source range and returns `null` if coverage is missing. It is **not** an estimated deposit delivery time.
- Federal Reserve schedule coverage: 2026–2027.
- Chime provider table coverage: 2026 and 2027-01-01 only; future 2027 dates are `unknown`, not guessed.
- Mobile-friendly read-only view reuses `/work/os` controls and displays source attribution.
- Reference can be consumed by ATLAS Finance, Accounting, Payroll or ATLAS Work **after** source approval and integration in the authorized server workflow. The current code does not automatically alert users, run payroll, read accounts or create transfers.

## Safety, money movement and compliance

1. No funds movement, deposit retrieval, bank account access, API credentials, auto-spending, or billing changes.
2. Do not promise Chime early payment, same-day ACH, holiday posting or exact settlement dates. Employer and payment processors control submission timelines.
3. Do not conflate FedACH processing window with retail-bank opening hours, FedNow, debit-card transactions or other payment rails.
4. Do not assume coverage from a source that has not published the date. Fail closed as `unknown`.
5. Preserve tenant-scoped RBAC/RLS and audit checks for any future persisted alerts, payment approvals or personalized calendars.
6. Source values are manually curated as of 2026-11-23; production needs periodic provenance checks and change review.

## Tests and release gates

- TDD contract tests created first, then module and UI implementation.
- Scenarios: Chime Thanksgiving 2026, next classified business day, Saturday July 4 distinction, 2027 Fed holiday observance, uncovered Chime future dates, invalid dates and non-executing state.
- Require exact-head typecheck, unit/integration tests, accessibility, build, security review and production E2E before claiming delivery.
- Branch/PR are independent of PR #1117 workspace governance. Both must pass their own P0 gates; passing GitHub Actions does not cancel failing Vercel checks.
- Vercel preview deployment logs on PR #1117 remain an open blocker when API scope does not expose them. Do not merge or deploy PR #1117 merely because its GitHub jobs are green.

## Next integrations (not yet delivered)

- A verified bank/provider holiday feed with versioned snapshots and diff auditing.
- Configurable calendar/timezone per organization and payment rail.
- Tenant-scoped reminders and approval-required payroll cutoffs; human confirmation of provider-specific timing.
- Verified authenticated server operations and end-to-end production telemetry.

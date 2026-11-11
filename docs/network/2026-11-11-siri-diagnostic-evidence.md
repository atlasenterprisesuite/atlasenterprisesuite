# Siri entry and browser diagnostic evidence — increment 1

## Intent and reuse

The approved first ATLAS cycle joins a voice entry point, real connection checks,
a record of the result and a next action. It extends the existing
`/work/computer-operations` page, `probeComputerOperationsRoutes`, canonical
production contract and network guidance. No new route, backend, provider,
credential store or orchestration layer is introduced.

## Delivered behavior

- Each completed automatic or manual probe records an immutable snapshot with
  ISO timestamp, scope, route status and latency.
- Only the five most recent reports are retained, in component memory. Leaving
  or reloading the page clears them. Users can download JSON or explicitly clear
  the history. This is session evidence, not synchronized account memory.
- Empty or unfinished checks remain incomplete. Failed/unavailable checks and
  contradictory pass/non-200 results require attention. HTTP success never
  certifies a production release: `productionVerified` is always false.
- Reports omit runtime/account details and arbitrary error text. There is no
  automatic upload or browser persistent storage.
- Siri setup instructions use an Apple Shortcuts URL + Open URLs shortcut named
  `ATLAS diagnóstico`, targeting the existing canonical diagnostic center. The
  existing automatic critical probes run on that page in production.

## Choices and boundaries

A native App Intents integration would require an Apple application target,
signing and device verification. A token-bearing HTTP shortcut would introduce
credential and tenant boundaries. For this increment, a URL-opening shortcut
reuses the existing page and authentication without granting new data access.

The web app cannot install or verify an Apple shortcut on the user's device.
Manual shortcut creation and a real Siri voice test remain external acceptance
steps. No native Siri integration, spoken diagnostic response, Wi-Fi switching,
6G support, cross-device memory or unattended execution is claimed.

Official Apple instructions:
https://support.apple.com/guide/shortcuts/apd07c25bb38/ios

## Acceptance and verification

- Unit coverage: snapshots, timestamp, empty/pending/failing checks, contradictory
  HTTP evidence, error-text exclusion, export contents and explicit clearing.
- Integration coverage: existing page → automatic probes → session report →
  repeated checks → five-report bound → failure export → clear history.
- Run focused tests, repository typecheck/build and the repository test command.
  Record actual failures separately; do not infer success from the focused tests.
- The initial full test run passed 2,553 assertions but failed to collect four
  `node:test` suites in Vitest. The test command now runs these suites through
  Node, preserving the default Vitest exclusions and the existing Local Core
  command. No security tests are omitted.
- The active main ruleset requires `council-security` on every PR. Its workflow
  previously filtered by paths, leaving unrelated PRs blocked with a missing
  check. It now runs on all PRs targeting main; the required security gate and
  its test command are unchanged.
- CI, merge, Cloudflare deployment and canonical exact-SHA P0 verification must
  pass before calling the change production verified.

Local results on 2026-11-11: focused coverage 17/17; full `npm test` passed
2,554 Vitest tests in 536 files plus 8 Node security tests and 13 Local Core
tests. Typecheck, production build, design gate and 9 Sentinel Shield tests
passed. Dependency audit reported zero vulnerabilities. The build retains its
bundle-size advisory (main JavaScript chunk exceeds 500 kB). These results
describe the working tree, not a deployed revision.

## Follow-up

Cross-device evidence persistence must first reuse the authenticated tenant
storage/audit API and prove isolation, retention and revocation. Direct native
Siri actions require a separately verified Apple app integration. Both remain
outside this bounded first increment.

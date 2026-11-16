# Execution ledger — 2026-11-16-future-accounting

Base: f632c3140e20e99b34808682f3109f24146078b4. Branch: codex/future-accounting-20261116.

- Inspected canonical remote main and existing finance, accounting package, navigation and governance.
- Isolated worktree protects concurrent ATLAS work in other checkouts.
- Approach: local comparison first; no provider, bank, medical, carrier or hardware capability is implied.
- User's standing autonomous-execution instruction governs routine design and implementation decisions.
- Task 1: domain implemented in ad1604a. Initial missing-contract assertion failed as expected; domain plus adjacent accounting tests passed (38 tests at that point). Follow-up coverage includes 10,000-row ambiguity and calendar-window boundaries.
- UI test environment initially lacked the existing repository's React global convention; fixed test setup before evaluating behavior.
- Precision regression: accepted maximum safe cent amounts displayed incorrectly after division by 100. Added failing UI regression, then format via BigInt and Intl parts to preserve exact minor digits.
- Full-suite navigation coverage caught the new navigation entry without a production verification route. Added the route to the existing P0 contract (version 36), preserving fail-closed verification.
- Independent whole-branch review held merge on three findings: explicit empty CSV records silently discarded; empty file-selection changes retained stale evidence; authorized production fallback could omit the new route. All were reproduced with failing tests before correction.
- Fixes: preserve explicitly provided CSV records for validation; invalidate source/read generation/report on empty selection; include the route in the existing authorized verifier and require per-route HTTP 200, nonempty version identity and exact expected SHA tag in its existing workflow consumer. Missing proof fails closed even before the updated verifier is deployed.
- Full-suite follow-up caught the deliberate route inventory snapshot needing the new route; updated the expected route inventory without removing assertions.
- Browser verification blocked: standalone Chromium launch failed under the execution environment's socket restrictions; the available cloud browser could not reach the local development server (connection refused). No visual/mobile/browser-E2E pass is claimed.
- Task 2: code and regression tests present. Full local npm test passed 2,598 Vitest tests (539 files), 24 Node tests and 13 Local Core tests, 2,635 total. Typecheck, production build, edge source verification and diff checks passed. Browser/CI/production gates remain separate.
- Regression verification: 64 focused tests passed. The first full run after review fixes passed 2,595 tests and hit three 5-second test timeouts while executing the real fallback shell under parallel load. Increased only those shell-test timeouts to 20 seconds (the child-process cap remains 15 seconds); no product assertion or release check was relaxed.
- Standard git push has no configured GitHub CLI credentials; use the connected repository API rather than requesting or searching for secrets.
- Published draft PR #1057 through the connected repository API. Its initial tree 5dcc48d68ba9bb70b7df6f905ef1e2f20acb3884 exactly matched the tested local tree; remote commit 7fd88734dd0f39d34a0030670f3a5cc765603836. No merge or deployment is claimed.
- Extend the existing accessibility workflow to audit the new route and run the real browser fixture on its local production preview. This reuses its runner and installed Chrome rather than claiming the blocked local browser passed. Playwright 1.62.1 is isolated verification tooling, matching the installed runtime version; application dependencies remain unchanged. The fixture checks original-byte hashes, download, import removal/error/clear, page errors, mutation requests and desktop/tablet/mobile overflow; uploads synthetic-only evidence.

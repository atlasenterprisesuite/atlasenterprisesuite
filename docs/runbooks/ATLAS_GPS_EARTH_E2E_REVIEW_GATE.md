# ATLAS GPS 4D — Authenticated Browser & Independent Review Release Gate

Scope: PR #999 on `atlasenterprisesuite/atlasenterprisesuite`.
Status: **P0 NO-GO** until all evidence listed below exists. This document does not authorize merge or deploy.

## Reuse and boundaries

- Use the existing React `/gps` route, `RequireAtlasIdentity`, Supabase tenant verification and GPS 4D selected-point links.
- Playwright WebKit is an automated **engine-level browser test**, not proof of physical iOS Safari behavior.
- No test bypasses ATLAS Identity. Never hardcode user tokens, passwords, refresh tokens, sessions or provider secrets.
- Do not generate a synthetic `APPROVED` review or treat the 3-of-3 CI consensus as a GitHub PR approval.

## Automated browser test (not executed until authorized target exists)

The branch contains:
- `tests/e2e/playwright.gps.config.mjs`: strict HTTPS origin allowlist, expected SHA, dedicated test credentials, single WebKit worker and disabled screenshots/traces/video.
- `tests/e2e/gps-earth-authenticated.e2e.mjs`: verifies exact deployment SHA before inputting credentials; unauthenticated rejection; sign-in via the existing Identity screen; active-organization access; no external links before selection; Paris shared coordinates; Google/Apple URL attributes, privacy disclosure and popup navigation; null, blank, out-of-range and legitimate zero coordinates.

Only a trusted, authorized runner with an **already provisioned** exact-PR-SHA preview and a **dedicated test user who belongs to an active test organization** may execute it. Never authorize tests by making a production user available in CI or by leaking session storage.

The trusted runner must supply these five values from a protected secret store (no values written to files or shell history):

| Environment variable | Contract |
| --- | --- |
| `ATLAS_E2E_BASE_URL` | HTTPS root URL of the release candidate |
| `ATLAS_E2E_ALLOWED_ORIGIN` | Independently configured exact allowlisted HTTPS origin |
| `ATLAS_E2E_EXPECTED_SHA` | The current 40-character PR HEAD, **not** an earlier green SHA |
| `ATLAS_E2E_EMAIL` | Authorized dedicated E2E identity |
| `ATLAS_E2E_PASSWORD` | Dedicated E2E identity credential |

After populating the environment securely, install dependencies in an ephemeral isolated workspace and run:

```sh
npm ci
npm install --no-save --package-lock=false --ignore-scripts @playwright/test@1.56.1
npx playwright install webkit
npx playwright test --config tests/e2e/playwright.gps.config.mjs
```

The `tests/e2e/*.e2e.mjs` naming is intentionally excluded from the normal Vitest unit/integration pattern. The suite is **not part of current required checks**; do not treat normal CI green as completion. It intentionally fails closed when target, origin, SHA, test identity or test organization is absent/invalid. The upstream preview must expose exact `x-atlas-version-id` **and** `x-atlas-version-tag` headers.

Avoid automatic untrusted PR execution with credentials. Do not upload auth traces, HAR, storage state, test-session screenshots, raw network bodies or credentials as GitHub artifacts.

## Physical iPhone Safari — independent device gate

Record a non-sensitive signed or otherwise attributable tester evidence entry (without credentials, cookies or customer data) containing:
- Tester/reviewer identity and authorization, device model, iOS/Safari version and timestamp.
- Exact preview deployment SHA and the HTTP headers used to verify it.
- Sign-in through ATLAS Identity with authorized test account; unauthenticated and no-membership rejection.
- Open `/gps` with no coordinates (no Google/Apple links); open `/gps?lat=0&lon=0` (valid); reject `lat=&lon=0` and out-of-range coordinates.
- Navigate to a known selected point; verify privacy notice, link destinations and successful user-initiated Google/Apple app/web handoff; return to ATLAS.
- Confirm keyboard/VoiceOver labels, focus, touch targets, and failure states when a provider is offline.

A passing headless Linux WebKit test **does not satisfy this physical-device gate**.

## Independent code review

Before requesting review, verify the intended reviewer is a real **authorized collaborator** with permission to review in this repository, distinct from the PR author. The current `.github/CODEOWNERS` lists only `@atlasenterprisesuite` for `/apps/web/`, and prior Codex auto-review was blocked by provider usage limits.

Reviewer must independently inspect the exact HEAD diff for coordinate parse and range logic, tenant boundary, no secrets, navigation safety, accessibility, privacy notice, geographic URL formatting, and unanticipated side effects. Record an actual GitHub `APPROVED` review from that authorized independent account, addressing all blocking findings first. The author cannot approve their own PR. No arbitrary reviewer should be invited without verifying their affiliation/permission.

## Last-mile release gates

- Verify **effective** protected `main` ruleset and mandatory check contexts through GitHub administrator evidence (source `docs/governance/MAIN_BRANCH_REQUIRED_POLICY.md` is desired state, not proof of enforcement).
- Inspect exact latest HEAD CI after **every** code change; review additional warnings, including React act warnings, as P1 if no runtime harm.
- Keep this PR Draft until all P0 proofs are complete and explicit integration authorization is recorded.
- After authorized merge/deploy, verify production through existing ATLAS Manager/Cloudflare `x-atlas-version-*` exact deployed SHA and existing `verify-production-p0` / global verification tools. No production success claim from PR CI alone.

**Current disposition: Browser test prepared, NOT EXECUTED; physical Safari NOT VERIFIED; independent reviewer NOT APPROVED; P0 NO-GO.**

# ATLAS 777 REVIEW — PR #1072 CI and standards audit (2026-11-18)

## Exact reviewed commit

`53ffd3b5cd5b2099d4ddb4b4be592740d4243a2a`

## GitHub Actions observed

- ATLAS Consensus CI: success (run 44257608189)
- CodeQL Advanced: success (run 44257608144)
- ATLAS Accessibility Validation: success (run 44257608306)
- ATLAS Evidence Engine CI: success (run 44257608395)
- ATLAS Build + Production Readiness Gate: failure (run 44257608199, job 134642943198)
- ATLAS Commerce CI: failure (run 44257608325, job 134642947067)

**Root blocker from both failed job logs:** `npm ci` finishes, then `npm run verify:all` stops at its first step, `npm audit --audit-level=high` (exit 1). Audit reports **5 high severity advisories** in the transitive dependency tree including `picomatch`, `fdir`, `tinyglobby`, `vite`, `vitest`. Specific advisory shown: GHSA-fc5q-39xc-vjpf (picomatch ReDoS). GitHub output suggests `npm audit fix --force` and a potentially breaking change, **not approved without testing**.

### Safe remediation plan

1. Inspect actual `npm ls picomatch fdir tinyglobby vite vitest` / `npm audit --json` from a clean checkout at the PR SHA.
2. Select safe fixed dependency versions from official advisories and compatibility constraints; avoid uncontrolled major downgrades/upgrades.
3. Regenerate `package-lock.json` using `npm install --package-lock-only` with authorized package registry access in a disposable environment. Do not hand-edit dependency integrity hashes.
4. Run `npm ci`, `npm audit --audit-level=high`, `npm run test:6g`, `npm run typecheck`, `npm run test:unit`, `npm run verify:all` against the resulting commit.
5. Require successful PR CI and review on the **new exact SHA**. No merge or deploy while P0 remains.

### Verification caveats

- The GitHub workflow records above refer to the reviewed commit, not necessarily this document's newer SHA.
- Existing successful Accessibility Validation does not prove interactive E2E or accessibility acceptance of the new research screen.
- Production route `/connect/wireless/6g-research` could not be reached by external public inspection; no E2E claims.
- Browser connected-tab enumeration was unavailable outside its originating extension/browser context. No user tabs were read.

## 6G official standards and research

- ITU-R IMT-2030 framework / M.2160: https://www.itu.int/rec/R-REC-M.2160/en
- ITU-R IMT-2030 work program: https://www.itu.int/en/ITU-R/study-groups/rsg5/rwp5d/imt-2030/pages/default.aspx
- 3GPP release portal (Rel-20/Rel-21 open): https://portal.3gpp.org/Releases.aspx
- IEEE 5G/6G Innovation Testbed: https://testbed.ieee.org/our-platform/how-it-works/

**Research distinction:** IEEE testbed operates with a 5G test platform to experiment with future capabilities; this is not public commercial 6G connectivity. Lab access, pricing, permissions and participation are not verified for ATLAS.

## ATLAS gates

- P0 FAIL CLOSED — no real 6G claim, eSIM/SM-DP+ profile, radio transmission, MVNO mutation, carrier contract or public deployment.
- P0 BLOCKED — dependency audit failure and missing exact-SHA green CI/readiness chain.
- P1 — formal ITU/3GPP traceability mapping to individual checks, accessible interaction verification and tested lab-partner onboarding remain outstanding.
- No payments, contracts, merges, RF activation, or production changes performed.

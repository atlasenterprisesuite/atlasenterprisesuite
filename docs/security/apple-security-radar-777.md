# ATLAS Security Radar 777 — Apple software release observer

Status: **implementation candidate / P0 NO-GO** (not merged, deployed or verified in production).

## Reused ATLAS components

- Canonical `packages/security/` workspace: no parallel security subsystem.
- Existing `tests/node/` test runner and `.github/workflows/` validation pattern.
- Existing ATLAS 777 production verification remains the only production release authority.

## Primary sources

1. Apple Software Lookup Service: https://gdmf.apple.com/v2/pmv
2. Apple Security Releases: https://support.apple.com/en-us/100100
3. Apple documentation for software update deployment:
   https://developer.apple.com/documentation/devicemanagement/deploying-software-updates-using-declarative-management

The first implementation directly observes **only `PublicAssetSets`** for the platform keys `iOS`, `macOS`, and `visionOS`. The `iOS` key also contains certain other Apple platforms and MUST NOT be interpreted as only iPhone releases. Unrecognized platforms are reported for human review. Other sets (`AssetSets`, `PublicBackgroundSecurityImprovements`) remain unimplemented.

A catalog entry is evidence of a *published software version and supported hardware identifiers*, not a confirmed CVE, exploitability judgment, device compliance assessment, or verification that a specific device installed an update.

## Usage

Local offline tests (no network or credentials):

```bash
node --test tests/node/apple-security-radar.test.mjs
```

Read-only provider observation (requires outbound HTTPS to Apple):

```bash
node packages/security/src/appleSecurityRadarCli.mjs
```

The CLI writes `.atlas-state/security/apple-radar/state.json` and `result.json`.
It creates the first baseline with **zero alerts**; subsequent snapshots identify new or changed release records. SHA-256 fingerprints bind the observed source payload and normalized release data. State files are review artifacts, not tenancy-aware records or authoritative device inventory.

The new GitHub Actions workflow runs tests on relevant pull requests. Its live provider job requires a manual `workflow_dispatch`, so external fetch and caching are NOT automatically enabled by the PR. No automatic issue generation, device administration, or remediation has been added.

## Fail-closed contract

- Reject malformed JSON, unexpected source redirects, HTTP errors, oversized responses, invalid schema or corrupted prior state.
- Do not overwrite the prior baseline when the provider request fails.
- Do not infer CVE identifiers, severity, affected devices, or successful remediation.
- No credentials, Apple MDM enrollment, personal device identifiers, privileged actions or data migrations.
- No production-readiness claim until exact-SHA CI and required platform gates are evidenced.

## Acceptance gates

- [ ] CI success on PR HEAD for syntax and offline Node tests.
- [ ] Repository-wide typecheck/tests/build and relevant security scans.
- [ ] Live Apple source fetch, observed payload and artifact checked on authorized runner.
- [ ] Human-reviewed source-to-advisory correlation, including CVEs and Background Security Improvements.
- [ ] Appropriate scoped inventory and authorization model before any real-device matching.
- [ ] Exact-SHA merge/deployment/production verification if a production-facing feature is subsequently added.

**P0 release verdict: NO-GO.** All changes stay on a review branch pending evidence.


## Increment 002 — Apple CSAF 2.1 advisory ingestion

Apple advisory pages can expose vendor-supplied CSAF JSON. A verified example is article `149715`:
- Human-readable page: https://support.apple.com/en-us/149715
- Vendor CSAF JSON: https://support.apple.com/content/dam/edam/applecare/images/en_US/otherassets/security/149715.json
- Schema URI: https://docs.oasis-open.org/csaf/csaf/v2.1/schema/csaf.json

The `appleCsafAdvisory.mjs` adapter:
- Constructs vendor URLs **only** from validated numeric advisory IDs (SSRF/path-injection boundary).
- Checks `document.csaf_version`, category, publisher identity, tracking ID, final status and exact official self-link.
- Validates nested product IDs and each CVE's `product_status.fixed` list against the product tree; rejects unsupported or inconsistent records.
- Creates a **zero-alert baseline**, then reports newly published, changed and removed CVE entries for review.
- Reports advisory-level aggregate severity only when provided by Apple; this must not be relabeled as individual CVE severity.
- Never equates `fixed` with confirmation of a particular user's vulnerable installation.
- Maintains evidence hashes, explicit reviewed/verified states and rejects provider errors.
- Has no credentials, device identifiers, tenant records, automatic ticket creation or remediation.

Local synthetic validation:

```bash
node --test tests/node/apple-security-radar.test.mjs tests/node/apple-csaf-advisory.test.mjs
```

Manual provider observation **after** the workflow is available on the default branch:

```bash
node packages/security/src/appleCsafAdvisoryCli.mjs --advisory-id 149715
```

No automatic scheduling or publication of unreviewed security advisories is enabled. CSAF data is a separate evidence source from the software release catalog; version-only matches are insufficient to establish exposure or device remediation.

### Increment 002 pending gates

- [ ] Validate the new Node test suite on the exact current PR HEAD.
- [ ] Confirm the real CSAF 149715 document can be fetched and parsed on an authorized runner.
- [ ] Audit changes to Apple CSAF schemas and product IDs on further advisories before scaling coverage.
- [ ] Add explicit tenant-scoped inventory and RBAC before correlating a real personal device.
- [ ] Review all CI checks, resolve any required failures, then consider merge/deploy through existing release protocol.

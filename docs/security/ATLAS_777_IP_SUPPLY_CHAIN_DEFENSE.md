# ATLAS 777 REVIEW — Intellectual Property, Repository & Supply-Chain Defense

Status: proposed hardening; source changes are not verified in production until CI, merge, deployment and exact-SHA production evidence pass.

## Evidence and access boundaries (11 Oct 2026)

- Canonical source: `atlasenterprisesuite/atlasenterprisesuite` (GitHub owner type: User).
- Repository is **public** and **template-enabled**. Anyone can read public files, clone, or create a new repository from the template. Turning the repository private or removing template mode requires a separate reviewed provider-level change with an assessment of CI/CD, public homepage and dependencies.
- Repository API reports no license object; this is not a substitute for a signed commercial licensing and IP ownership decision. Absence of a license does not make publicly accessible code impossible to copy.
- An **active** main-branch ruleset exists. At review time its PR approval count was **zero** and `require_code_owner_review` was **false**; there is also a privileged integration bypass actor. Do not infer a malicious user from this configuration; inventory the approved actor before restricting it.
- `.github/CODEOWNERS`, `SECURITY.md`, CodeQL, the canonical production verifier and a GitHub security baseline are present. Verify their **current runs and runtime effect**; configuration does not equal successful enforcement.
- The separately inspected `ishandutta2007/Awesome-Packaged-Integration-Connectors` repository is a market/engineering directory, not evidence by itself of infringement. Do not accuse or report anyone without substantial original-code or asset matches and a verified provenance timeline.

## P0 — enforce and verify

1. **Prevent new embedded credentials:** Sentinel P0 detection cannot be ignored via `sentinel:ignore`. The required GitHub security baseline scans added/modified/copied/renamed files against the PR base SHA and fails on P0; existing untouched findings require separate remediation. Secret values never appear in reports.
2. **Protect source controls:** keep main ruleset active, block force-push/deletion, and require passing `github-security-baseline`, build-readiness and CodeQL checks; ensure the required checks actually run on every PR.
3. **Human access:** require passkeys and independent recovery. Confirm MFA, access lists, deploy identities, scoped tokens and GitHub App permissions directly in the providers; do not export secrets into audit logs.
4. **Credential incident response:** if a genuine token is discovered, revoke/rotate via provider controls, check audit logs, examine usage, and redeploy only with proven clean secret references. Git history rewrite is not a substitute for rotation.
5. **Data isolation:** test Supabase RLS/RBAC across tenants and MFA/AAL gates, Cloudflare WAF/rate-limit rules and signed OIDC scopes separately before claiming application-level protection.

## P1 — provider/owner decisions pending

- **Protection against unauthorized reuse:** Inventory genuinely proprietary modules, trademarks, artwork and datasets. Split sensitive backend code into an appropriate private repository **only after** checking deploy path and preserving canonical history. Do not move the live source or alter repository visibility without a safe migration plan and recovery test.
- **Review requirement:** Once at least one independent trusted maintainer can approve PRs, require `>=1` review, code-owner review, dismiss stale approvals and resolved threads. Current personal repository with a single maintainer must not be deadlocked by turning on impossible approvals.
- **Bypass actors:** review the ruleset integration bypass ID and remove unused bypasses after identifying the legitimate automation's purpose. Never revoke a deployment identity blindly.
- **Template mode:** disable `is_template` if verified unnecessary, because it reduces one convenient route for copying (not ordinary clone access).
- **Historical provenance:** preserve first-authored commits, timestamps, signed releases and SHA-256 asset records. A public Git repository timestamp supports provenance, not automatically an infringement finding.
- **License & ownership:** decide the proper open-source, source-available or proprietary license for each code area with appropriate IP advice. Don't copy MIT-licensed code into proprietary subsystems without satisfying notice and attribution obligations.

## Remaining limits

- Regex scanning does not identify every secret, software flaw, malware infection, supply-chain attack or plagiarism; P1/P2 findings remain triage warnings. Add dedicated secret-scanning push protection, SCA/SBOM, dependency pinning and artifact attestations after compatibility checks.
- A green PR is only a source validation result; it does not prove a production deployment, absence of data exfiltration or third-party code access.
- No public evidence currently establishes that a named external developer stole, targeted or accessed ATLAS.
- Track CI run URLs, reviewed diff, merge SHA, production SHA, externally checked policy settings, and incident evidence without revealing sensitive material.

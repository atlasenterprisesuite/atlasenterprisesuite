# ATLAS `main` Branch Required Policy

Date: 2026-09-15
Repository: `atlasenterprisesuite/atlasenterprisesuite`

This file defines the required GitHub administrative state for the canonical production branch. It is desired-state governance; source control alone does not turn GitHub repository settings on.

## Required branch/ruleset controls

- Changes to `main` require a pull request; direct push is not an approved release path.
- Git force push must be disabled.
- Branch deletion must be disabled.
- Pull-request review conversations must be resolved before merge.
- Required status checks must be current with the branch before merge.
- Administrators should be included in the same rules unless an emergency procedure explicitly records a temporary bypass and follow-up evidence.
- Release commits should have verifiable provenance/signature when produced through GitHub's merge flow.

## Required checks

The protected release line must require the applicable exact-head checks, including:

- `ATLAS 3-of-3 Consensus`
- `CodeQL Advanced` language analysis required for changed/runtime languages
- `ATLAS Build + Production Readiness Gate`

Feature-specific CI may add additional required checks for affected paths. A passing build is not equivalent to a passing production deployment.

## Production completion

After merge, the exact merged SHA must independently pass the production-readiness gate and the Cloudflare deployment/runtime verification pipeline. ATLAS Manager evidence must identify that exact SHA. Provider or edge blocks must be recorded as blocked rather than converted to success.

## Current external administration gate

The connected GitHub capability used by ATLAS can read branch/ruleset state but does not expose repository-administration mutation for branch protection. Until a repository administrator applies this policy in GitHub, the control remains `EXTERNAL ADMIN GATE`; it must never be reported as enabled merely because this document exists.

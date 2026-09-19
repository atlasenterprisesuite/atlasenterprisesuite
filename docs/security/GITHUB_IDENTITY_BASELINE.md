# ATLAS GitHub Identity & 2FA Baseline

Status date: 2026-09-19

## Current verified boundary

The canonical repository is `atlasenterprisesuite/atlasenterprisesuite`.

At the time this baseline was introduced, GitHub reported the repository owner `atlasenterprisesuite` as owner type `User`, not `Organization`. Therefore organization-wide member 2FA enforcement cannot truthfully be claimed yet.

This document is intentionally fail-honest: repository controls are automated now; organization-level controls become enforceable only after the canonical repository is owned by a GitHub Organization.

## Required human identity controls

For privileged ATLAS GitHub access:

1. Primary authentication: passkey or hardware security key where available.
2. Independent backup: TOTP authenticator.
3. Recovery: offline GitHub recovery codes stored separately from the primary authenticator.
4. SMS: not the preferred or sole privileged second factor.
5. No shared human administrator accounts.
6. Machine access must use GitHub Apps, OIDC/workload identity or narrowly-scoped machine credentials.

## Required organization controls after migration

When the canonical repository is under a GitHub Organization:

- Require two-factor authentication for organization members and outside collaborators.
- Enable secure two-factor methods where the GitHub plan/settings expose that control.
- Review outside collaborators before enforcement.
- Keep CI/CD identities separate from human identities so 2FA enforcement cannot break deployments.
- Keep CODEOWNERS and branch/ruleset protections for security-sensitive paths.
- Verify the setting from current GitHub state before marking the control active in ATLAS Security.

## Repository guardrails enforced now

`.github/workflows/github-security-baseline.yml` checks:

- `.github/CODEOWNERS` exists and protects security-sensitive paths.
- GitHub Actions do not use `permissions: write-all`.
- GitHub Actions do not use `pull_request_target`.
- Production verification remains fail-closed and continues to verify critical ATLAS Network routes.
- OIDC remains part of the authorized production verification path.
- The current GitHub repository owner type is recorded in the job summary.

Missing top-level workflow `permissions` declarations are reported as warnings so legacy workflows can be hardened incrementally without silently weakening the checks above.

## Migration completion condition

The GitHub identity work is complete only when all of the following are true:

- Canonical repository owner type = `Organization`.
- Organization member 2FA requirement = enabled.
- Secure 2FA methods = enabled where available.
- Privileged owners have at least two independent recovery-capable authentication methods.
- Automation uses machine identity rather than shared human credentials.
- Repository rulesets protect `main` and security-sensitive changes.
- The repository security baseline workflow is green.

# Security Policy

ATLAS Enterprise Suite treats security, tenant isolation, authorization, provider truth and auditability as release requirements.

## Reporting a vulnerability

Do not open a public issue containing exploit details, credentials, tokens, private keys, personal data, tenant data or reproduction material that could expose users. Use GitHub's private security reporting / Security Advisory flow for this repository when available. If private reporting is not available, contact the repository owner privately before publishing technical details.

Include the affected component, impact, prerequisites, a minimal reproduction, and whether the issue crosses an authentication, tenant, RBAC, financial, health, production or provider boundary.

## Supported branch

`main` is the only production-stable source branch. Historical and integration branches are not production authority.

## Human identity and GitHub access baseline

Privileged ATLAS GitHub access must use phishing-resistant authentication wherever GitHub supports it.

- Prefer a passkey or hardware security key for the primary sign-in path.
- Maintain TOTP as an independent recovery-capable second factor.
- Store GitHub recovery codes offline in a protected location that is not the same device as the primary authenticator.
- SMS must not be the sole or preferred second factor for privileged ATLAS access.
- Shared human GitHub accounts are prohibited for production administration.
- CI/CD, bots and provider automation must use GitHub Apps, OIDC/workload identity or scoped machine credentials rather than a human account.
- When the canonical repository is owned by a GitHub Organization, organization-wide 2FA must be required and secure 2FA methods should be enforced before production access is delegated to additional members or outside collaborators.
- A GitHub ownership or identity control must never be marked enforced unless it is verified against the current GitHub configuration.

## Security invariants

- Never commit credentials or provider secrets.
- Preserve Supabase RLS, organization scoping and RBAC.
- Privileged mutations must preserve MFA/AAL and approval requirements where applicable.
- Cloudflare edge behavior must fail safely and must not substitute for application authorization.
- External/provider capabilities must not be labeled connected, live, ready or verified without current evidence.
- Sensitive mutations require audit evidence and must not be made merely to silence a linter/advisor.
- GitHub Actions must not use `permissions: write-all` or `pull_request_target` without an explicit reviewed exception and compensating controls.

## Release verification

A security-sensitive change is not complete until the applicable dependency audit, typecheck, tests, CodeQL, production build, deployment and runtime verification gates are green on the exact release SHA.

The repository-level GitHub security baseline is enforced by `.github/workflows/github-security-baseline.yml`. Human-account and organization-level 2FA remain provider controls and must be verified directly in GitHub before being claimed as active.

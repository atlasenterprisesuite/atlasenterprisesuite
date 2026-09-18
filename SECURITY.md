# Security Policy

ATLAS Enterprise Suite treats security, tenant isolation, authorization, provider truth and auditability as release requirements.

## Reporting a vulnerability

Do not open a public issue containing exploit details, credentials, tokens, private keys, personal data, tenant data or reproduction material that could expose users. Use GitHub's private security reporting / Security Advisory flow for this repository when available. If private reporting is not available, contact the repository owner privately before publishing technical details.

Include the affected component, impact, prerequisites, a minimal reproduction, and whether the issue crosses an authentication, tenant, RBAC, financial, health, production or provider boundary.

## Supported branch

`main` is the only production-stable source branch. Historical and integration branches are not production authority.

## Security invariants

- Never commit credentials or provider secrets.
- Preserve Supabase RLS, organization scoping and RBAC.
- Privileged mutations must preserve MFA/AAL and approval requirements where applicable.
- Cloudflare edge behavior must fail safely and must not substitute for application authorization.
- External/provider capabilities must not be labeled connected, live, ready or verified without current evidence.
- Sensitive mutations require audit evidence and must not be made merely to silence a linter/advisor.

## Release verification

A security-sensitive change is not complete until the applicable dependency audit, typecheck, tests, CodeQL, production build, deployment and runtime verification gates are green on the exact release SHA.

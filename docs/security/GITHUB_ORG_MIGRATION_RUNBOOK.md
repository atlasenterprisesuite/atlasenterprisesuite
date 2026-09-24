# ATLAS GitHub Organization Migration Runbook

Status: preflight implemented; transfer not yet authorized because no target GitHub Organization exists.

## Objective

Move the canonical ATLAS repository from a personal-account owner to a GitHub Organization without breaking GitHub OIDC, Supabase Edge Functions, Cloudflare production verification, HubSpot repair workflows, CI/CD, or ATLAS Network.

## Security model

ATLAS uses `ATLAS_GITHUB_REPOSITORIES` as an explicit comma-separated allowlist for GitHub OIDC repository identities. The first entry is the canonical repository. `ATLAS_CANONICAL_REPO` remains a compatibility fallback for non-OIDC consumers.

Default state:

`ATLAS_GITHUB_REPOSITORIES=atlasenterprisesuite/atlasenterprisesuite`

Migration window:

`ATLAS_GITHUB_REPOSITORIES=atlasenterprisesuite/atlasenterprisesuite,<TARGET_ORG>/atlasenterprisesuite`

Post-migration state:

`ATLAS_GITHUB_REPOSITORIES=<TARGET_ORG>/atlasenterprisesuite`

The migration window must be short. The legacy repository identity is removed from the allowlist only after the transferred repository, CI, deployment, and production verification are green.

## Pre-transfer gate

Before transferring ownership:

1. Create the target GitHub Organization under a distinct namespace.
2. Confirm the human owner uses phishing-resistant 2FA plus an independent recovery method.
3. Require organization-wide 2FA and secure methods when available.
4. Add the target repository identity to `ATLAS_GITHUB_REPOSITORIES` in the authorized Supabase runtime.
5. Keep the legacy identity temporarily in the allowlist.
6. Run `node scripts/verify-github-org-migration-readiness.mjs`.
7. Require ATLAS GitHub Security Baseline, CodeQL, full CI and production build to be green.
8. Audit Cloudflare, Supabase, AWS, Google, HubSpot and any external GitHub App/OIDC trust for explicit owner/repository strings.

## Transfer

Transfer the repository only after the pre-transfer gate is green. Do not rename the current personal account to reclaim the old owner/repository pair.

## Post-transfer verification

Verify the exact transferred SHA and require all of the following:

- repository owner type = Organization;
- organization-wide 2FA = enabled;
- secure 2FA methods = enabled where available;
- ATLAS GitHub Security Baseline = GREEN;
- CodeQL = GREEN;
- full CI/build = GREEN;
- Cloudflare deploy = GREEN;
- Global Production Verification = GREEN;
- `https://www.atlasenterprisesuite.com` = verified;
- critical ATLAS Network routes = verified:
  - `/business/network`
  - `/business/network/pricing`
  - `/business/network/commissions`
  - `/business/network/payouts`
  - `/business/network/compliance`.

## Cleanup

After all post-transfer checks pass:

1. Set `ATLAS_GITHUB_REPOSITORIES=<TARGET_ORG>/atlasenterprisesuite`.
2. Set `ATLAS_CANONICAL_REPO=<TARGET_ORG>/atlasenterprisesuite` where still used.
3. Remove the legacy personal-account repository identity from every provider trust policy.
4. Re-run security baseline, CodeQL, CI/build and production verification.
5. Update canonical-repository documentation.
6. Close GitHub issue #298 only after the final fail-closed production verification is green.

No migration phase may be reported as complete from redirects alone; current provider state and production evidence are required.

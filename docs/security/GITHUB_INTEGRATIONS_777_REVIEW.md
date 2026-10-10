# ATLAS GitHub integrations: live permission and ruleset audit

Observed 2026-10-08. Scope: atlasenterprisesuite/atlasenterprisesuite, default branch main.

## Verified evidence (not completion)

- GitHub reports main protected, and ruleset 22915870 (ATLAS Main Protection.) active on ~DEFAULT_BRANCH.
- Ruleset includes deletion and non-fast-forward prevention, a pull request requirement, six required checks, and a CodeQL rule.
- Permanent bypass actor: type Integration, id 946600, bypass_mode always. The API response did not reveal its app name or business owner. Identity and necessity remain unverified. **Never remove blindly or mark this exception approved.**
- Pull request settings currently have required_approving_review_count=0, require_code_owner_review=false, required_review_thread_resolution=false and dismiss_stale_reviews_on_push=false.
- CodeQL alerts_threshold is errors (not errors_and_warnings).
- Automatic Copilot review_on_push is true.
- The canonical repository owner is a personal GitHub User account, not an Organization. CODEOWNERS names this account alone; requiring one independent approval without an eligible reviewer may prevent every merge.
- The connected ChatGPT GitHub App installation 155361515 reported repository_selection=all. This proves the installation's selection policy, not that all external apps have this scope.
- API access to branch-protection administration was denied; current connector provides no authorized ruleset mutation or OAuth authorization inventory operation.

This state is **P0 unresolved** until the bypass is identified and privileged GitHub settings are changed and re-read with independent evidence. Do not infer full OAuth authorization coverage from repository metadata.

## Reused protection and new check

Continue using github-security-baseline.yml, CodeQL, production-deploy.yml and the existing CODEOWNERS policy. Do not create a second deploy pipeline.

The new github-live-ruleset-audit.yml runs unit policy tests for relevant PRs and performs a read-only, fail-closed live ruleset audit on schedule or manual dispatch. The check reports the observed main SHA, blocking conditions and warnings in GitHub Actions job summary. Initially it is **not a required merge check**: current provider policy mismatches would deadlock ongoing PRs. Make it a required check only after a passing authorized live audit and a negative test PR.

To reproduce in an authorized Actions run:

    node --test tools/security/github-live-ruleset.checks.mjs
    node scripts/verify-github-live-ruleset.mjs

No personal access token is committed; Actions supplies a read-scoped ephemeral GITHUB_TOKEN. The audit must fail closed if ruleset data is missing or GitHub refuses reads.

## Administrator remediation sequence

1. In GitHub, open repository Settings > Rules > Rulesets > ATLAS Main Protection. Identify bypass Integration 946600 by its displayed app name, owner and actual production jobs. Capture evidence before changing it. If the bypass is unneeded, remove it after checking dependency impact; otherwise design a short-lived, narrowly scoped replacement and document a justified exception. Do not retain an undocumented permanent bypass.
2. Require review-thread resolution and dismiss stale approvals upon new pushes. Confirm the six currently enforced check names are still emitted by CI. Remove automatic Copilot review only if the verified external job remains unreliable; preserve manual Copilot review if useful.
3. Determine whether an independent reviewer can actually approve PRs. After onboarding a trusted distinct reviewer, require one human approval and code-owner review for sensitive paths. Avoid introducing an impossible merge gate on a single-user repository.
4. In GitHub Settings > Applications > Installed GitHub Apps, review installation 155361515 and limit repository selection where doing so does not break the ATLAS connection. For all other apps, record publisher, repository selection, per-permission read/write access, last use, webhook events, secret rotation owner and removal procedure.
5. In GitHub Settings > Applications > Authorized OAuth Apps, review every OAuth grant separately. OAuth repository scopes may be broader than GitHub App fine-grained Contents:read. Revoke stale or untrusted grants, but stage changes to active CI/CD integrations. Do not grant deletion, repository administration or workflow write permissions without a separately evidenced need.
6. Prefer GitHub Apps and OIDC workload identities over classic personal tokens. Preserve CodeQL, protected main, RBAC, zero-trust webhooks, verified signatures and deployment exact-SHA checks.
7. Run the live audit, capture its exact main SHA, perform a negative-test PR, inspect required checks and confirm Cloudflare/Supabase/ATLAS production gates still work. Update issue #505 with evidence; close only after verified completion.

## Fail-closed P0 vs documented P1

P0: unverified always-bypass, inactive/untargeted ruleset, unprotected main, missing strict required checks, missing high-severity CodeQL gate, missing review-thread resolution, stale-approval protection disabled, unavailable source SHA or failed provider read.

P1: zero independent human approvals until a separate eligible reviewer is available, CODEOWNERS review disabled, weaker CodeQL general alert threshold, and the optional automatic Copilot review dependency. These warnings remain open until accepted and mitigated; P1 is not evidence of readiness.

This document authorizes **no administrative mutation** and **no production-ready claim**. External GitHub ruleset and OAuth/app permission changes must be performed with provider-authorized credentials and verified again.

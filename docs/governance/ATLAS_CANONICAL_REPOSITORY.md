# ATLAS Canonical Repository

Effective date: 2026-09-06

## Canonical source of truth

The operational canonical repository for ATLAS Enterprise Suite is:

`atlasenterprisesuite/atlasenterprisesuite`

This repository is the source of truth for active ATLAS implementation, integration, CI, release governance, and production evidence until a dedicated product repository is explicitly created and migrated through an audited change.

## Branch authority

- `main` — production-stable branch. Only verified, approved integration work lands here.
- `release/atlas-a-z` — current A-Z integration and closure branch. It may advance ahead of `main` while release gates are incomplete.
- Feature branches — isolated implementation work. They must converge through review and verification rather than becoming parallel sources of truth.

## Legacy repository policy

`winderaranguren-gif/Atlas-enterprise-suite` is treated as a legacy/historical source whose current accessibility is not required for ongoing ATLAS execution.

Loss of access to a legacy repository MUST NOT block implementation, testing, CI repair, integration, or release work in the operational canonical repository.

If legacy access is restored later:

1. compare histories and file-level differences;
2. identify unique work not already represented in the canonical repository;
3. import only validated, non-duplicate changes through auditable commits or pull requests;
4. preserve newer or stronger implementations already present in ATLAS;
5. never force-push canonical history merely to match a legacy repository.

## Continuity rule

If a historical repository, provider, branch, credential, or integration becomes unavailable, ATLAS continues with all independent work that remains technically possible. A missing historical source is a reconciliation task, not a global blocker.

## Production truth

Repository status, CI status, deployment status, runtime status, and public URL verification are separate facts. No ATLAS component is called `live`, `verified`, `connected`, `production ready`, or `100% functional` unless the corresponding evidence exists.

## Dedicated product repository target

Because `atlasenterprisesuite/atlasenterprisesuite` is also the GitHub special profile repository (owner and repository names match), the preferred long-term product repository name is:

`atlasenterprisesuite/atlas-enterprise-suite`

Creating that repository is a repository-administration operation, not a prerequisite for current ATLAS development. Until that repository exists and an audited migration completes, `atlasenterprisesuite/atlasenterprisesuite` remains canonical and work continues here without interruption.

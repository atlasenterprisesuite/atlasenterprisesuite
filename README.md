# ATLAS Enterprise Suite

**Operational canonical repository for ATLAS.**

ATLAS Enterprise Suite is the shared enterprise platform for people, finance, operations, security, communication, intelligence, health, mobility, productivity, and connected services.

## Repository authority

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
- Production-stable branch: `main`
- A-Z integration branch: `release/atlas-a-z`
- Production URL: `https://www.atlasenterprisesuite.com`
- Governance: `docs/governance/ATLAS_CANONICAL_REPOSITORY.md`
- Infrastructure control plane: `docs/architecture/ATLAS_MANAGER_SPEC.md`
- Intelligence runtime migration: `docs/architecture/GPT_6_ASTRA_MIGRATION.md`
- Primary backend/control plane: Supabase `atlas-core` (`ggmanzcgtlrvqfoccgsh`)
- Primary public edge target: Cloudflare
- Primary OpenAI intelligence model: `gpt-6-astra` through the Responses API

The previously referenced `winderaranguren-gif/Atlas-enterprise-suite` repository is legacy/historical and is **not a blocker** for current ATLAS development. If access returns, unique work is reconciled through comparison and auditable integration; canonical history is not force-replaced.

## Operating rule

ATLAS advances continuously through analysis, implementation, correction, testing, integration, deployment gates, and verification. Work stops only when a real human, legal, authorization, or technically irresolvable dependency makes further progress impossible. Independent work continues even when another dependency is blocked.

ATLAS Manager is the shared infrastructure control plane and deployment brain for the required GitHub → Supabase → Cloudflare → Production path. Vercel and other deployment providers are optional adapters unless an approved release explicitly marks them required. Provider-specific deployment mechanisms must converge through ATLAS Manager instead of becoming isolated sources of infrastructure truth.

## Vercel account selection (2026-11-23)

- Requested Vercel account identity for future ATLAS Vercel work: `atlasenterprisesuite` (account selector observed in signed-in Vercel UI; ChatGPT connector also authenticates as this username).
- **An account is not a project.** The currently connected Vercel integration enumerates no projects and returns `404` for the previously identified project. This update is **not** a verified Vercel project switch or deployment.
- Previously observed GitHub-linked Vercel candidate: project `atlas_enterprise_suite`, ID `prj_bEmcb8yOURzifoWObjSw0UnJyslh`, team `winderaranguren-gifs-projects`. This historical candidate is **not** verified as the selected deployment target under the preferred account. Do not silently substitute `atlas-enterprise-suite-web` or create a duplicate project.
- Before a Vercel deployment: positively verify intended **account/team, project ID, repository link, root directory, build command, output directory, and permissions**. Fail closed on API `404` or `403`; verify build logs, required checks, exact commit, and preview behavior before production promotion.
- With the Vercel root set to the repository root, this monorepo builds using `npm run build` and emits `apps/web/dist`. See draft [PR #1092](https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/1092) for the unmerged `vercel.json` candidate; do not claim it fixed any deployment until verified.
- Vercel remains **optional** under [ATLAS Manager](docs/architecture/ATLAS_MANAGER_SPEC.md); Cloudflare remains the primary public edge provider. This records preferred account identity only; it does not change production authority, ownership, billing, domains, or live provider settings.

## Truthful production state

Code, validation, deployment, runtime, provider authorization, public-edge routing, and public production verification are tracked separately. Provider-dependent capabilities never claim `live`, `online`, `connected`, `ready`, or `verified` status without evidence.

A successful build/readiness workflow means the canonical source passed its software gates. It does **not** by itself mean that Cloudflare has deployed the artifact or that the public ATLAS domains are serving that build.

## Long-term repository layout

Because this repository name matches the GitHub account name, GitHub also treats it as the profile repository. The preferred future dedicated product repository is `atlasenterprisesuite/atlas-enterprise-suite`. That migration is non-blocking; this repository remains the canonical source until the new repository exists and migration is explicitly verified.

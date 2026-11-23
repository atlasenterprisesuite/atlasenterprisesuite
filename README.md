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

## Vercel selected target (2026-11-23)

- User-selected Vercel account/team: `atlasenterprisesuite`. Vercel's GitHub integration for [PR #1131](https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/1131) confirms the associated project `atlasenterprisesuite`, project ID `prj_Noqa7O1rBBxXPftJ9Ss3Qv1uIR1F`, team ID `team_7BYVUafzk8OeaXbAy0IPHSeF`, and dashboard URL `https://vercel.com/atlasenterprisesuite/atlasenterprisesuite`.
- **Target selected, API authorization pending.** The ChatGPT Vercel connection returns `403` for this team's scope. A team-specific authorization is required before reading or changing project settings. The GitHub integration's project link does **not** prove a successful build or deploy.
- Previous distinct Vercel project `atlas_enterprise_suite` (ID `prj_bEmcb8yOURzifoWObjSw0UnJyslh`; team `winderaranguren-gifs-projects`) is **legacy for Vercel targeting**. Never substitute it for the selected `atlasenterprisesuite` project, and do not delete or transfer it without explicit approval.
- For the monorepo, when Vercel's root directory is the repository root, the expected build command is `npm run build` and its output directory is `apps/web/dist`. The proposed `vercel.json` remains in unmerged [PR #1092](https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/1092); settings on the selected Vercel project have **not** been verified or changed yet.
- GitHub currently reports Vercel status failures pointing to a **build-rate-limit / upgrade** page; this is not evidence that a new build reached the output-directory step. Do not trigger repeated builds or authorize a paid upgrade to bypass the limit without explicit approval.
- Before promoting a release, verify account/team access, project settings, Git repository connection, correct SHA, build logs, required CI checks and preview routes; fail closed on authorization or verification errors.
- This is an optional Vercel adapter under [ATLAS Manager](docs/architecture/ATLAS_MANAGER_SPEC.md). The canonical production edge remains Cloudflare until a separate, verified production cutover is approved. No domain ownership or billing changes are authorized by this record.

## Truthful production state

Code, validation, deployment, runtime, provider authorization, public-edge routing, and public production verification are tracked separately. Provider-dependent capabilities never claim `live`, `online`, `connected`, `ready`, or `verified` status without evidence.

A successful build/readiness workflow means the canonical source passed its software gates. It does **not** by itself mean that Cloudflare has deployed the artifact or that the public ATLAS domains are serving that build.

## Long-term repository layout

Because this repository name matches the GitHub account name, GitHub also treats it as the profile repository. The preferred future dedicated product repository is `atlasenterprisesuite/atlas-enterprise-suite`. That migration is non-blocking; this repository remains the canonical source until the new repository exists and migration is explicitly verified.

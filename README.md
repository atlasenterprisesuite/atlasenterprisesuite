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

## Vercel optional adapter — verified target (2026-11-23)

- **Selected team:** `atlasenterprisesuite` (`team_7BYVUafzk8OeaXbAy0IPHSeF`); **project:** `atlasenterprisesuite` (`prj_Noqa7O1rBBxXPftJ9Ss3Qv1uIR1F`); Git source: `atlasenterprisesuite/atlasenterprisesuite`. Always scope provider API operations to this exact team/project; the account's previously observed `defaultTeamId` points to the legacy team and must not be relied on.
- **Verified code fix:** merged [PR #1133](https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/1133) at `fb42e57a9441bd38d258134fbd94439f66472aac`. The root `vercel.json` uses `framework: vite`, `buildCommand: npm run build`, and `outputDirectory: dist`. The build generates both canonical `apps/web/dist` for the Cloudflare workflow and verified `dist` with `index.html` and `deployment.json` for Vercel. [PR #1092](https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/1092), which proposed an earlier output setting, is closed as superseded.
- **Vercel deployment evidence:** production-targeted deployment `dpl_JTzP2XXzBNEuTLFVs54bynUgTXGf` of that exact merge SHA reported `READY`; the build logs show the compatibility output and completed deployment. This proves the Vercel build/deployment status, **not** authenticated runtime E2E or Cloudflare public production readiness.
- **Legacy check isolation:** historical team `winderaranguren-gifs-projects` (`team_EA8QAUJZhToSSR9gCGEfF4ju`) currently enumerates zero Git-linked projects and still emits failing GitHub commit statuses due to an earlier build-rate limit. Do not interpret those statuses as a failure of the scoped project above, but do not bypass any required GitHub branch checks. Reconcile the legacy integration or required-check names through approved administrative settings.
- **Domain boundary:** `atlasenterprisesuite.com` is still associated with the old Vercel team, has no project-domain association there, and uses Cloudflare nameservers. Do not migrate domains, change DNS, alter Cloudflare Access, or buy upgrades as part of this optional build correction.
- **Release authority:** canonical production remains GitHub → Supabase ATLAS Manager → Cloudflare. Treat Vercel and Cloudflare runtime states separately. Cloudflare Access currently prevents anonymous verification of the canonical public URL; require authorized health, route and exact-SHA evidence before certifying Cloudflare production.

## Truthful production state

Code, validation, deployment, runtime, provider authorization, public-edge routing, and public production verification are tracked separately. Provider-dependent capabilities never claim `live`, `online`, `connected`, `ready`, or `verified` status without evidence.

A successful build/readiness workflow means the canonical source passed its software gates. It does **not** by itself mean that Cloudflare has deployed the artifact or that the public ATLAS domains are serving that build.

## Long-term repository layout

Because this repository name matches the GitHub account name, GitHub also treats it as the profile repository. The preferred future dedicated product repository is `atlasenterprisesuite/atlas-enterprise-suite`. That migration is non-blocking; this repository remains the canonical source until the new repository exists and migration is explicitly verified.

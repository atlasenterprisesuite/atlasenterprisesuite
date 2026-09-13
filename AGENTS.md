# ATLAS Enterprise Suite — Codex Instructions

## Canonical repository

This repository, `atlasenterprisesuite/atlasenterprisesuite`, is the canonical source of truth for ATLAS Enterprise Suite.

- Default and canonical branch: `main`.
- Do not create, migrate to, or treat another repository as canonical unless explicitly instructed by the repository owner.
- Reuse the existing architecture before adding new modules, routes, services, components, tables, APIs, or infrastructure.
- Preserve working functionality that is more complete than a visual reference or task description.

## Product implementation rule

When a task includes an image, screenshot, dashboard, interface, design, app screen, menu, or visual reference related to ATLAS, treat it as a product specification and implementation instruction, not as an image to describe or embed as a mockup.

Use this implementation flow:

`REFERENCE -> ANALYSIS -> CLASSIFICATION -> EXISTING ATLAS -> ARCHITECTURE -> MODULE -> ROUTE -> NAVIGATION -> COMPONENTS -> DATA -> PERMISSIONS -> FUNCTIONS -> TESTS -> COMMIT -> DEPLOY -> VERIFY`

Do not fake production functionality. Empty data must render a real empty/configuration state rather than invented metrics. Connected/live/online states must reflect actual integrations.

## Architecture

ATLAS is a connected enterprise ecosystem, not a collection of isolated apps.

The repository currently uses npm workspaces under `apps/*` and `packages/*`.

Primary application:

- `apps/web`

Primary backend platform direction:

- Supabase for database, authentication, storage, backend services, and related integrated capabilities when applicable.

Infrastructure must be compatible with the ATLAS Manager / Infrastructure Control Plane direction and should preserve existing GitHub, Cloudflare, Supabase, and production integration patterns already present in the repository.

Before introducing a new dependency, service, route, schema, or source of truth, inspect the repository for an existing equivalent.

## Security and tenancy

Preserve and respect:

- authentication and sessions;
- organization and tenant isolation;
- RBAC and permissions;
- auditability for sensitive operations;
- secrets boundaries;
- production/development separation.

Never commit credentials, API keys, tokens, passwords, private certificates, recovery codes, or provider secrets.

Sensitive operations must verify authorization. Do not weaken access controls merely to make a flow pass locally.

## Navigation and UX

All visible controls representing actions or navigation must work to the greatest extent supported by the existing architecture.

Avoid:

- `href="#"` placeholders;
- buttons that only log to the console;
- fake loading or connected states;
- unsupported "Coming Soon" screens when the functionality can reasonably be implemented;
- screenshot-as-interface substitutions.

Where relevant implement real states for:

- active;
- hover;
- selected;
- expanded/collapsed;
- loading;
- disabled;
- empty;
- error;
- success.

Maintain usable navigation depth with established ATLAS patterns such as sidebar, breadcrumbs, tabs, detail pages, and return navigation.

## Data behavior

Reuse existing APIs, database tables, services, hooks, schemas, and shared utilities.

Search, filters, tabs, forms, tables, sorting, pagination, CRUD, export, printing, and uploads must perform the represented operation when implemented. Do not invent business data or production metrics to make a screen look populated.

## Development commands

From the repository root use the existing package scripts.

Install dependencies reproducibly:

```bash
npm ci
```

Primary validation commands:

```bash
npm run typecheck
npm test
npm run build
```

During focused work, use narrower tests where available, but run the appropriate full validation before declaring the task complete.

## Definition of done

Do not claim a task is complete or production-ready without evidence.

Before completion, verify as applicable:

1. imports and TypeScript checks;
2. unit/integration tests;
3. production build;
4. affected routes do not produce 404/500 errors;
5. navigation reaches the intended final action;
6. forms validate and persist through real available persistence;
7. responsive behavior for desktop, tablet, and mobile;
8. empty/error/loading/success states;
9. authentication and authorization boundaries;
10. no secrets were introduced;
11. no obvious regressions in adjacent ATLAS functionality.

If a production dependency is unavailable, implement up to the real dependency boundary and state exactly what is missing. Never simulate an active external integration.

## Git workflow

Keep changes focused and understandable.

- Inspect before modifying.
- Prefer small coherent commits.
- Do not rewrite unrelated code without a concrete reason.
- Do not force-update protected/shared branches.
- Run validation before proposing merge.
- When using a task branch, target `main` for integration unless explicitly instructed otherwise.

## Codex working principle

Do not repeatedly diagnose the same problem without advancing it. When permissions and evidence allow, inspect, implement, test, and continue. Stop only for a genuine authorization/security boundary, missing credential or external dependency, irreversible/destructive action requiring approval, or a technical blocker that cannot be resolved from the repository and available tools.

## Sovereign AI three-agent baseline

The required ATLAS engineering collaboration baseline is:

- **ChatGPT / OpenAI — Architect + Orchestrator.** Own task decomposition, architecture, evidence correlation, governed state transitions, and the human-facing control loop. The consumer ChatGPT session is not an undocumented runtime API.
- **Codex — Engineer + QA.** Implement code, run tests, perform focused review, prepare commits/PRs, and work in isolated branches/worktrees. Codex cannot approve or deploy its own production release.
- **Gemini — Independent Reviewer + Research.** Use the existing governed ATLAS intelligence gateway for explicit reviewer/research calls. Gemini has no direct repository or production mutation authority.

GitHub Copilot is optional. Do not block ATLAS implementation because Copilot is unavailable.

For runtime intelligence, reuse `supabase/functions/atlas-copilot/`. Do not create a second AI bus. Provider routing must be explicit and auditable, and provider/model/status fields must describe the provider that actually executed the request.

## TDD and evidence discipline

For production behavior changes use RED -> GREEN -> REFACTOR:

1. write a focused failing test;
2. execute it and confirm it fails because the behavior is missing;
3. implement the minimum change;
4. re-run the focused test;
5. run the relevant broader suite;
6. refactor only while tests stay green.

Never claim TDD evidence if a runner failed before the test step executed.

Before claiming implementation complete, run the applicable repository gates, including when relevant:

```bash
npm ci
npm audit --audit-level=high
npm run test:unit
npm run test:integration
npm run typecheck
npm run build
```

If GitHub Actions exits before steps run, report CI as **blocked**, not code-failed and not passed. Local tests do not replace required CI or live runtime verification.

Never label a provider, integration, deployment, route, or service `connected`, `verified`, `ready`, `live`, or `production` without fresh evidence.

## Release authority

The expected collaboration flow is:

`ChatGPT plan -> Codex implement/test -> Gemini independent review -> Codex fix -> ATLAS QA / 3-of-3 CI -> human approval -> deploy -> post-deploy verification`

No agent may merge or deploy solely because its own work passed local tests. Production changes require the existing ATLAS human approval gate. Preserve tenant/org isolation, RBAC, audit trails, Supabase persistence, and approval-gated repair/deployment controls.

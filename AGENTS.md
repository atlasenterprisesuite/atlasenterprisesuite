# ATLAS Enterprise Suite — Codex Instructions

## Binding execution protocol

The repository-wide operating contract is `docs/governance/ATLAS_MASTER_AUTONOMOUS_EXECUTION_PROTOCOL.md`.

Execute ATLAS work continuously from inspection through verification without pausing for intermediate approval unless a genuine authorization, security, provider, billing/spend, irreversible-action, external-dependency, or unresolvable technical boundary exists. Do not create a parallel execution architecture.

Provider roles are fixed unless the repository owner explicitly changes them:

- GitHub: canonical source, change history, CI/review evidence, and release coordination.
- Cloudflare: primary web/edge delivery and production verification boundary.
- Gemini: governed intelligence/review provider through the existing `atlas-copilot` provider registry when runtime readiness is actually verified.
- GitHub Copilot: optional engineering assistance only; it is not an orchestrator, source of truth, or production authority.

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

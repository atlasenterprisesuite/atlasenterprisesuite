# Atlas Cloud — reference coverage and environment audit

Date: 2026-09-24
Implementation branch: `feat/atlas-cloud-platform`
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`

## Scope and truth boundary

This audit does not claim 100% coverage of Google Cloud documentation. The reference is a large documentation estate. The reviewed scope is the public documentation landing experience plus directly relevant pages for overview, service catalog, product registry, knowledge catalog and documentation updates. The implementation copies no Google branding, text, code or assets; it reuses only general information-architecture patterns.

## Reference inventory

| URL | Directly observed function | Main observed elements | Atlas Cloud equivalent |
| --- | --- | --- | --- |
| https://docs.cloud.google.com/ | Documentation landing page | Global search, getting-started cards, product search, language/tool links, updates, resource footer | `/cloud/docs`: documentation home, original ATLAS copy, connected catalog and console entry |
| https://docs.cloud.google.com/docs | Documentation discovery hub | Guides, quickstarts, tutorials, use cases and code-sample discovery | ATLAS documentation categories and routed articles |
| https://docs.cloud.google.com/docs/overview | Platform overview | Explains cloud hierarchy, projects, services and interaction model | `/cloud/docs/get-started`: canonical source, backend, edge and identity model |
| https://docs.cloud.google.com/service-catalog/docs | Service catalog docs | Guides, references, catalog management and discoverability | `/cloud/docs/catalog`: searchable catalog generated from `ATLAS_MODULES` |
| https://docs.cloud.google.com/service-catalog/docs/overview | Service catalog overview | Curated solutions, admin/user experience and governance | Atlas module registry + identity/readiness metadata |
| https://docs.cloud.google.com/product-registry/overview | Product registry | Product hierarchy and authoritative registry concept | Canonical `apps/web/src/modules/registry.ts` as the UI source registry |
| https://docs.cloud.google.com/knowledge-catalog/docs | Knowledge catalog | Search, governance, lineage and contextual discovery | Connected entry to Knowledge Atlas from Atlas Cloud Console |
| https://docs.cloud.google.com/docs/whats-new | Documentation updates | Filterable updates and links to release resources | Proposed future ATLAS Cloud release/update feed sourced from Release Control |

## Observed vs inferred vs proposed

Directly observed:
- Google Cloud documentation uses a documentation-first landing experience with prominent search and discovery.
- Product/service discovery is separate from deeper product documentation.
- Service catalog concepts emphasize discoverability and governance.
- Documentation surfaces link into a distinct console/operational environment.

Inference:
- The separation between documentation and console reduces cognitive load by letting users learn before operating.
- A canonical service registry is preferable to hard-coded duplicated catalog lists.

Atlas proposal:
- Keep public documentation at `/cloud/docs`.
- Keep the administrative console at `/cloud` behind ATLAS Identity.
- Generate the catalog from the existing module registry.
- Reuse Manager Readiness, Release Control, Automations and Knowledge instead of creating parallel control planes.
- Keep production state fail-closed and evidence-backed.

## ATLAS environment inventory

### Source and applications

Connected/verified through GitHub:
- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Default branch: `main`.
- Primary web application: `apps/web`.
- Additional applications: `apps/atlas-orchestrator`, `apps/visionos`.
- Workspace architecture: `apps/*` and `packages/*`.
- Primary language: TypeScript.
- Repository instructions: `AGENTS.md` and the master autonomous execution protocol.

### Backend and data

Connected/verified through Supabase:
- Organization: `Atlas-core`.
- Active healthy project: `atlas-core` (`ggmanzcgtlrvqfoccgsh`), region `ca-central-1`.
- Inactive projects also exist: `atlas-core-v2`, `atlas-core-v2-replay`, and `Atlas-core`; they are not treated as production authorities.
- Public schema contains organization, identity/RBAC, module registry, work/execution, accounting, release/deployment, observability, integration, commerce, hospitality and other ATLAS tables.
- RLS is enabled on the inspected application tables returned by the provider.
- Edge Functions and migrations are present and source-controlled in the repository.

Security advisories observed at audit time:
- One authenticated-executable `SECURITY DEFINER` warning for `has_oracle_entitlement(text)`.
- Supabase leaked-password protection is disabled.
These are environment findings, not silently corrected by Atlas Cloud UI work because both affect existing security policy beyond this module's scope.

### Infrastructure and deployment

Repository-authoritative configuration:
- GitHub: canonical source, CI/review evidence and release coordination.
- Supabase: primary database/auth/storage/backend direction.
- Cloudflare: primary public edge target and production verification boundary.
- ATLAS Manager: shared infrastructure control plane and deployment brain.
- Vercel: optional adapter unless an approved release explicitly requires it.

Public production URL declared by repository governance:
- https://www.atlasenterprisesuite.com

The implementation does not claim a provider is live merely because configuration exists. Current connectivity must be read through Manager Readiness and Release Control evidence.

### Identity, roles and integrations

Verified model from repository + active database:
- Organizations and organization memberships exist.
- Identity permissions and role-permission tables exist with RLS.
- Platform-admin bootstrap and organization-scoped permissions are source-controlled.
- Integration registries exist; provider secrets are represented through guarded references rather than plaintext UI state.

No raw secret values were read or recorded in this audit.

### Automation and verification

Existing repository commands include:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run verify:all`
- `npm run verify:production:global`

Existing deployment architecture separates source validation, provider deployment evidence and public production verification. Atlas Cloud reuses those boundaries.

## Implemented Atlas Cloud slice

Created:
- `apps/web/src/modules/cloud/AtlasCloudRoutes.tsx`
- `apps/web/src/modules/cloud/cloud.css`
- `tests/integration/atlas-cloud-routing.test.tsx`

Integrated:
- public documentation routes under `/cloud/docs`
- protected administrative console at `/cloud`
- searchable/filterable service catalog generated from the canonical module registry
- console links to Manager Readiness, Release Control, Automations and Knowledge Atlas
- responsive desktop/tablet/mobile layouts
- honest empty state and readiness wording
- no duplicated backend, secret store or deployment source of truth

## Pending reference coverage

Not yet exhaustively reviewed:
- every individual Google Cloud product documentation page;
- every language/client-library reference;
- every Architecture Center article;
- every API reference and tutorial;
- authenticated Google Cloud Console flows.

These are intentionally out of scope for this first implementation slice and should be added only when an ATLAS Cloud requirement maps to them.

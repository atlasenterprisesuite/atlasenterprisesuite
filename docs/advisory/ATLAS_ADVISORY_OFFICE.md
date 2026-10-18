# ATLAS Advisory Office

Status: durable core implemented
Canonical repository: atlasenterprisesuite/atlasenterprisesuite
Firm #001: AW Finance Advisory Solutions

## Implemented

Advisory Office now has organization-scoped Supabase persistence for firms, firm memberships, clients, engagements, Business Launch 360 evidence and immutable-style audit events. Writes use authenticated RPCs that derive the active organization from ATLAS identity. Browser callers do not supply an organization ID to write operations.

The protected routes include Overview, Clients, Engagements and Business Launch 360. Clients and engagements use real persisted records. Launch Readiness is calculated only from verified evidence across ten dimensions and verified evidence requires a non-empty reference.

AW Finance is bootstrapped as Firm #001 only inside the authenticated active organization. No clients, engagements, revenue, invoices or readiness evidence are seeded.

## Architecture boundaries

CRM remains the prospect/opportunity source of truth. Accounting remains the invoice/payment ledger. Tasks reuse the canonical ATLAS execution/work layer. External e-sign, calendar, document storage, print fulfillment, paid media, payment and publishing providers remain fail-closed until authorized and verified.

Client Portal remains deny-by-default until authenticated client/delegate scope is implemented. Regulated professional claims are never inferred from the firm name or service catalog.

## Security

RLS is enabled on every Advisory persistence table. Reads require both the appropriate Advisory permission in the active organization and an active membership in the target firm. Mutations are executed through security-definer RPCs that validate auth.uid(), active organization membership, Advisory manage permission, firm ownership and resource scope before writing.

Audit events are append-only to authenticated users: browser users receive read access only when they hold Advisory admin or audit permissions.

## Release truth

Code merge is not production verification. Typecheck, focused Advisory tests, repository-wide CI, CodeQL, build, deployment and public route verification remain independent evidence gates.


## Production closure review — 2026-10-01

The Advisory core is no longer treated as one route with a collection of placeholders. Internal capabilities that already exist elsewhere in ATLAS now resolve to their canonical systems:

- Tasks and automations → ATLAS Work OS / Guided Execution.
- CRM → canonical Contacts, Companies, Opportunities, Activities and Integration readiness.
- Billing → canonical Accounts Receivable.
- Reports → persisted Advisory client, engagement and Business Launch 360 intake records, with Accounting and Analytics as external sources of truth.
- Settings → ATLAS Identity, Advisory provider readiness and platform accessibility settings.
- Compliance → evidence, approval and provider-authorization control surfaces without inferring professional status.

A dedicated `/advisory/readiness` route separates implemented capability from evidence still required. Production route verification now covers the Advisory overview plus Clients, Engagements, Business Launch 360 Workspace, Reports, Providers and Readiness.

### Remaining fail-closed dependencies

The following are intentionally not represented as production-complete:

1. Client Portal: requires authenticated client/delegate identity binding and negative cross-client access tests.
2. Calendar: requires an organization-authorized and provider-verified calendar connection.
3. Documents/e-sign: requires governed document storage plus authorized signature/delivery providers.
4. External print, paid media, payment and publishing: require organization authorization and provider verification.
5. Production release: still requires green CI/build/security gates, deployed exact-SHA evidence and successful production HTTP/E2E verification.

These dependencies are release gates, not simulated UI states.

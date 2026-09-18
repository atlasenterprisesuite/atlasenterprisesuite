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

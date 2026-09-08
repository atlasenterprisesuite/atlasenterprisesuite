# ATLAS Revenue Operations Wave

Status: implementation wave started on `release/atlas-a-z`

## Objective
Establish the first governed Revenue Operations foundation without duplicating existing Accounting, People, tenant, RBAC, audit, or Supabase contracts.

## Domain boundary
This wave covers CRM, Sales, Purchasing, Inventory, POS, and Projects as connected operational domains. Accounting remains the financial system of record for journals, AR/AP, bank/cash, reconciliation, assets, close, and reports.

## Architectural rules
- Reuse ATLAS Core tenancy, RBAC, and audit contracts.
- Reuse Supabase as the canonical backend and persistence target.
- Keep `release/atlas-a-z` as the integration axis; no parallel source of truth.
- Do not invent provider-live states, payment settlement, marketplace connectivity, tax filing, carrier connectivity, or external ERP/DMS synchronization.
- Preserve existing automotive sales reporting as a Finance/Accounting extension; do not treat it as the CRM/Sales operational source of truth.
- Separate implemented, migrated, tested, deployed, connected, and production-verified states.

## First implementation slice
1. Revenue Operations domain model and lifecycle contracts.
2. CRM account/contact/opportunity primitives.
3. Sales quote/order lifecycle primitives.
4. Purchasing requisition/PO lifecycle primitives.
5. Inventory item/location/movement primitives.
6. POS transaction primitives with provider-unconfigured settlement state.
7. Project/work-item primitives.
8. Tenant isolation and audit requirements for every write path.
9. Web navigation entry point and truthful empty/unconfigured states.
10. Unit/integration coverage before production acceptance.

## Production boundary
This plan authorizes source implementation only. It does not authorize A-Z merge to `main`, production deployment, provider activation, payment capture, external synchronization, or production data migration without the existing release gates.

# ATLAS Hospitality OS Core — Design Specification

Date: 2026-09-13
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/hospitality-os-core`

## 1. Purpose

ATLAS Hospitality OS is the unified operating system for hotels, restaurants, resorts, cafes, bars, and mixed hospitality groups. It extends the existing ATLAS Hospitality implementation instead of creating a parallel product. The system must support a single independent property and large multi-brand, multi-property organizations from the same tenancy, permissions, execution, audit, and intelligence architecture.

The product goal is to let a hospitality operator run guest operations, rooms, reservations, restaurants, orders, staff, inventory, purchasing, payments, accounting, maintenance, compliance, and analytics from one ATLAS ecosystem.

## 2. Product principle

Hospitality is one domain with two major operational subdomains:

- Hotel Operations
- Restaurant Operations

Both subdomains share one Hospitality Core and the same ATLAS Identity, Organization/Tenant, RBAC/ABAC, Universal Execution Engine, ATLAS Assistant, Orchestrator, Approval Center, Audit Trail, and evidence model.

No hotel or restaurant capability may introduce a separate identity silo, tenant model, approval system, audit system, or disconnected assistant.

## 3. Organization and property hierarchy

Canonical hierarchy:

`Organization -> Brand -> Property -> Outlet -> Space -> Operational Unit`

Definitions:

- Organization: legal or operating entity that owns or manages hospitality assets.
- Brand: customer-facing or management brand within the organization.
- Property: a physical hotel, resort, restaurant campus, mixed-use property, or location.
- Outlet: an operating venue inside a property, such as a restaurant, cafe, bar, spa, shop, or front desk operation.
- Space: a bookable or operational physical resource such as a guest room, table, meeting room, kitchen station, bar station, pool cabana, or event space.
- Operational Unit: a managed department or cost center such as Front Desk, Housekeeping, F&B, Maintenance, Security, Banquets, or Revenue Management.

Every transactional object must resolve to `organization_id`. Property-scoped records must also resolve to `property_id`. Outlet and space identifiers are optional only when the business event is not outlet- or space-specific.

## 4. Shared Hospitality Core

The first implementation slice establishes shared contracts for both hotels and restaurants.

Core entities:

- OrganizationContext
- HospitalityBrand
- HospitalityProperty
- HospitalityOutlet
- HospitalitySpace
- HospitalityOperationalUnit
- GuestProfile
- StaffAssignment
- HospitalityReservation
- HospitalityCharge
- HospitalityPaymentReference
- HospitalityTaskReference
- HospitalityAuditEvent

The core must not duplicate existing ATLAS global organization, user, identity, or payment primitives. Hospitality entities reference those shared contracts.

## 5. Hotel Operations

Hotel Operations will build on the existing room-access work already present in ATLAS Hospitality.

Planned functional areas:

- Property and room inventory
- Room types and room attributes
- Availability
- Reservations
- Rate plans and pricing
- Check-in / check-out
- Guest folios
- Deposits, incidental holds, refunds, and settlement references
- Housekeeping
- Maintenance and out-of-order rooms
- Digital room access and credentials
- Amenities and guest requests
- Incidents
- Loyalty / guest profile linkage
- Revenue and occupancy reporting
- Channel / OTA integration boundary

Existing room access, providers, rooms, credentials, and audit capabilities are retained and moved under the larger Hospitality OS navigation and domain contracts rather than rebuilt.

## 6. Restaurant Operations

Restaurant Operations shares the same property model and guest identity.

Planned functional areas:

- Dining rooms and tables
- Reservations and waitlist
- Menus and modifiers
- Recipes and ingredient consumption
- POS tickets and checks
- Kitchen Display System boundary
- Bar operations
- Pickup and delivery order boundary
- Tips and gratuities
- Inventory consumption
- Purchasing and vendors
- Waste and variance
- Food and beverage cost
- Loyalty and CRM linkage
- Restaurant sales and operational analytics

A restaurant inside a hotel is modeled as an outlet of the hotel property. A standalone restaurant is a property with one or more restaurant outlets. No separate restaurant tenant is required unless it is a separate ATLAS organization.

## 7. Cross-module event model

Hospitality must participate in the ATLAS event system rather than directly coupling domain modules.

Representative events:

- `hospitality.property.created`
- `hospitality.reservation.created`
- `hospitality.reservation.cancelled`
- `hospitality.guest.checked_in`
- `hospitality.guest.checked_out`
- `hospitality.room.status_changed`
- `hospitality.housekeeping.task_requested`
- `hospitality.maintenance.incident_reported`
- `hospitality.restaurant.order_opened`
- `hospitality.restaurant.order_paid`
- `hospitality.inventory.consumption_recorded`
- `hospitality.charge.posted`
- `hospitality.payment.settled`

Representative downstream effects:

- Check-in activates stay context, room-access workflow, folio context, housekeeping state, CRM context, and audit evidence.
- Check-out closes stay context, produces settlement/accounting handoff, updates room status, and records audit evidence.
- Paid restaurant orders emit revenue, inventory consumption, tip, guest/loyalty, and accounting events.
- Room maintenance incidents can remove a room from sellable inventory and create execution tasks.

## 8. Universal Execution Engine integration

Operational work must enter the shared Universal Execution Engine.

Examples:

- Prepare room for arriving guest
- Resolve out-of-order room
- Approve high-value refund
- Restock restaurant inventory
- Investigate POS variance
- Complete overnight audit exception
- Resolve guest complaint

Each Hospitality workflow must preserve the universal task fields already established by ATLAS, including task ownership, status, priority, current step, next action, dependencies, blocked reason, required permissions, evidence, timestamps, and audit history.

## 9. Intelligence and orchestration

ATLAS Assistant is the user-facing operational intelligence layer for Hospitality.

ATLAS Orchestrator coordinates multi-step and cross-module work through the existing provider-neutral Intelligence Router and governance boundaries.

Examples of allowed intelligence assistance:

- Summarize arrivals and departures
- Identify rooms at risk of missing readiness SLA
- Explain food-cost variance
- Suggest staffing adjustments
- Draft a recovery plan for an operational incident
- Surface abnormal refunds, voids, or occupancy anomalies

AI must not receive root privileges. Financial, destructive, high-risk permission, security, audit, or irreversible actions require the relevant approval policy.

## 10. Permissions and governance

Hospitality permissions extend existing ATLAS authorization rather than replace it.

Permission families should be scoped by capability, for example:

- `hospitality.property.read`
- `hospitality.property.manage`
- `hospitality.reservation.read`
- `hospitality.reservation.manage`
- `hospitality.frontdesk.checkin`
- `hospitality.frontdesk.checkout`
- `hospitality.housekeeping.manage`
- `hospitality.maintenance.manage`
- `hospitality.restaurant.order.read`
- `hospitality.restaurant.order.manage`
- `hospitality.restaurant.refund`
- `hospitality.audit.read`
- `hospitality.audit.admin`

Existing room-access permissions remain valid and must be integrated into this hierarchy.

Sensitive operations must support separation of duties where applicable, especially refunds, manual folio adjustments, payment reversals, credential administration, high-value comps, audit overrides, and permission changes.

## 11. Data isolation

All Hospitality data must be tenant-safe.

Minimum isolation guarantees:

- every record belongs to an ATLAS organization;
- property-scoped records cannot be read or mutated outside allowed property scope;
- outlet-level staff access can be restricted without hiding authorized corporate reporting;
- corporate users may aggregate across authorized properties;
- cross-property actions must preserve source and target property identity in audit evidence.

## 12. Financial integration

Hospitality does not own the canonical general ledger. It emits governed business events and references shared ATLAS Finance, Accounting, AP, AR, Tax, Payroll, and ATLAS Pay capabilities.

Examples:

- Room and restaurant revenue -> Accounting
- Vendor invoices -> AP
- Corporate/group receivables -> AR
- Tips and wage-related outputs -> Payroll
- Sales/lodging tax facts -> Tax
- Deposits, charges, refunds, and settlements -> ATLAS Pay / payment adapters

The Hospitality layer may present operational folios/checks, but accounting truth remains in the shared financial system.

## 13. Inventory and purchasing integration

Restaurant recipe depletion, minibar usage, housekeeping supplies, maintenance parts, and other hospitality inventory must integrate with shared ATLAS Inventory, Purchasing, and Vendors modules.

Hospitality owns operational context; Inventory owns canonical stock balances and movements.

## 14. Navigation model

Primary route family:

- `/hospitality`
- `/hospitality/overview`
- `/hospitality/properties`
- `/hospitality/hotels/*`
- `/hospitality/restaurants/*`
- `/hospitality/guests/*`
- `/hospitality/operations/*`
- `/hospitality/analytics/*`
- existing room-access routes remain supported during migration and must not become dead links.

The first UI slice should expose property context and preserve existing room-access capabilities while preparing navigation for the hotel and restaurant subdomains.

## 15. Error handling and operational safety

Hospitality commands must fail closed when organization identity, property scope, required permission, or authorization provenance cannot be verified.

Transient integration failures should create explicit blocked/degraded states rather than silently dropping operational work.

Financial or credential actions must be idempotent where supported and preserve external provider references in evidence.

No workflow may mark itself complete without verifiable evidence of the underlying action.

## 16. Audit and evidence

Every sensitive Hospitality operation must emit an auditable record with sufficient context to reconstruct what occurred.

Minimum audit attributes:

- event id
- organization id
- property id when applicable
- outlet id when applicable
- actor
- action
- subject/resource
- timestamp
- permission decision
- approval reference when required
- evidence/reference identifiers
- success/failure state

Audit records cannot be silently deleted by AI or ordinary operational roles.

## 17. Accessibility and responsive behavior

Hospitality interfaces follow ATLAS accessibility requirements and must support keyboard navigation, screen readers, scalable text, reduced motion where applicable, and responsive operation across desktop, tablet, and mobile form factors.

Operational screens used by front desk, housekeeping, restaurant, and maintenance staff must remain usable on touch devices.

## 18. Implementation decomposition

This architecture is intentionally implemented as multiple testable sub-projects, not one oversized branch.

Recommended sequence:

1. Hospitality Core + Property Operating Model
2. Hotel Reservations + Stay Lifecycle
3. Hotel Housekeeping + Maintenance
4. Restaurant Dining + Reservation Model
5. Restaurant POS + Order Lifecycle
6. Shared Inventory/Purchasing integration
7. Shared Finance/Accounting/Payments integration
8. Hospitality Assistant + Orchestrator workflows
9. Corporate multi-property analytics and operational command center

Each sub-project receives its own implementation plan and verification gates.

## 19. First implementation scope

The `feat/hospitality-os-core` branch is limited to the first sub-project: Hospitality Core + Property Operating Model.

It should establish:

- canonical hierarchy and types;
- property/outlet/space/operational-unit contracts;
- permission contracts;
- tenant/property scope validation helpers;
- property-aware navigation and overview surface;
- compatibility with existing room-access routes;
- event contracts for property creation and context selection;
- audit/evidence envelope for core property operations;
- unit and integration tests.

It must not attempt to implement a full PMS, POS, payment processor, OTA integration, accounting engine, or inventory engine in this first slice.

## 20. Verification criteria for the first scope

The first scope is complete only when fresh verification confirms:

- dependency install succeeds;
- TypeScript contracts pass;
- unit tests pass;
- integration tests pass;
- production build succeeds;
- existing Hospitality room-access routes remain functional;
- tenant/property scope tests prove cross-property access is denied by default;
- no catalog-only or unimplemented hotel/restaurant action is presented as operationally live.

No merge or deployment is implied by completion of this spec.
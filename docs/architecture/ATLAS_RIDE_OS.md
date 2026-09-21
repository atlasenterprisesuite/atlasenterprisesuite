# ATLAS Ride OS — Canonical Mobility Architecture

Status: implementation foundation
Date: 2026-09-21

## Product boundary

ATLAS Ride is the mobility operating system for an ATLAS organization. It owns mobility-specific state and workflow, while reusing canonical ATLAS services for identity, payments, accounting, tax, notifications, analytics and shared execution.

Ride MUST NOT create a second general ledger, payment processor, tax engine, customer master, identity system or generic notification engine.

## Canonical flow

Identity → Driver → Vehicle → Compliance → Readiness → Availability → Dispatch → Trip → Safety/GPS → Fare → Payment → Earnings → Commission → Payout → Accounting → Tax → Analytics → Audit

`Trip` is the central mobility entity. Every dispatch, route, fare, payment reference, earning, incident and accounting/tax handoff must reference the canonical trip id. No Ride subsystem may create a parallel trip truth source.

## Global gates

Every consequential Ride operation requires all four gates:

1. authenticated organization/tenant context;
2. explicit permission;
3. server-authoritative persisted state;
4. auditable evidence.

Fail closed when any gate is missing.

## Core owned entities

### Driver
Organization-scoped Ride participant linked to ATLAS Identity. Ride stores mobility-specific driver state only.

### Vehicle
Organization-scoped mobility asset. Registration, insurance, inspection and maintenance states remain evidence-backed and may not be inferred from UI state.

### Compliance requirement
Uses the existing shared compliance lifecycle. The documents surface is a registry over persisted requirements rather than isolated document pages.

Initial metadata keys: `profile_photo`, `driver_license`, `insurance`, `vehicle_registration`, `vehicle_inspection`, `background_check`.

A registry entry is metadata, not proof that a requirement exists. A requirement becomes actionable only when a persisted `compliance_requirements` row exists.

### Readiness
Readiness is derived from persisted requirements. It is not a manually editable green/red flag.

- `block_new_activity` + unresolved/expired requirement → block new Ride activity.
- `warning` + unresolved requirement → warning state.
- all applicable requirements satisfied/waived → eligible.
- missing required backend evidence → not ready/unknown; never fabricate compliance.

### Availability
Online/offline state is subordinate to readiness. A blocked driver cannot become available for new trips.

### Trip
The trip is the central server-authoritative mobility record.

Lifecycle: `requested → offered → accepted → driver_en_route → arrived → in_progress → completed`.
Terminal/exception states: `cancelled`, `no_show`, `disputed`.

Transitions must be explicit and auditable.

## Operational layers

### Dispatch
Matches a trip request to an eligible driver/vehicle. External dispatch providers remain disabled until connected and verified.

### GPS / Navigation
Ride stores references/evidence needed for a trip, but shared spatial/GPS services own generic mapping/navigation primitives. No fabricated traffic or live location.

### Pricing
All money is integer minor units + ISO currency. Fare calculation requires an effective-dated pricing policy. No policy means no computed production fare.

Components may include base fare, time, distance, tolls, airport/zone fees, promotions and approved adjustments.

### Payments
ATLAS Pay owns payment execution. Ride stores payment references and mobility settlement state. Uncertain provider responses must reconcile; never blindly double-charge.

### Earnings / Commission / Payout
Ride owns trip-level mobility earning allocations and payout intent. ATLAS Pay owns payout execution. Canonical Accounting owns ledger posting.

### Accounting
Ride emits governed business events/references. Accounting owns revenue, fees, commissions, payout liabilities, cash, refunds and journal truth.

### Tax
ATLAS Tax owns tax rules and tax reporting. Ride provides trip mileage, earnings, fees and classified mobility facts. It does not calculate unsupported tax rules locally.

## Extended operating systems

First-class Ride domains built on the same trip/driver/vehicle identity: Safety & Incident Center; Driver/Passenger Trust; Vehicle Lifecycle; Reservations & Scheduled Rides; Zones & Geofencing; Cancellation/No-show/Refunds/Disputes; Driver Wallet; Insurance & Claims; Support Center; Notifications; Fleet Mode; Business Rides; Accessibility; Fraud/Risk; Operations Command Center; Ride Analytics; Audit & Evidence.

## Safety and trust

Safety actions preserve actor, organization, trip, timestamps, location references when available, evidence references and escalation state.

Automated fraud/risk signals are advisory unless an explicit persisted policy authorizes an effect. High-impact restrictions require explainable reason codes and review/audit paths.

## Compliance registry behavior

The browser requests the active organization’s persisted Ride requirements and joins them to a code-owned presentation registry. Unknown requirement types render safely as governed custom requirements instead of disappearing.

The registry controls labels, descriptions and category metadata only. Backend requirement rows remain the truth for status, dates, eligibility effect and review lifecycle.

## Production truth rules

- No provider is shown connected until verified.
- No fare is shown authoritative without an effective pricing policy.
- No driver is shown eligible without readiness evidence.
- No payout is shown sent without ATLAS Pay/provider evidence.
- No accounting entry is shown posted without canonical Accounting evidence.
- No tax result is shown authoritative without ATLAS Tax/rule evidence.
- No live map/GPS state is fabricated.
- No biometric or identity confidence score is invented.

## Implementation sequence

1. Dynamic Documents Registry + readiness engine.
2. Driver/Vehicle/Trip core persistence and audit events.
3. Availability + Dispatch + Trip state machine.
4. GPS/spatial references + safety/incident workflow.
5. Effective-dated pricing + fare snapshots.
6. ATLAS Pay payment/earnings/commission/payout references.
7. Accounting + Tax event handoff.
8. Reservations, fleet, business rides, accessibility, trust/risk.
9. Operations command center + Ride Analytics.
10. E2E production verification, provider gates and fail-closed monitoring.
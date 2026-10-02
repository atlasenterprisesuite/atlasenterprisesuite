# ATLAS Urban Twin Core

Date: 2026-10-02  
Canonical route: `/city/twin`  
Parent surface: `/city`  
Security: ATLAS Identity + active organization + RBAC + Supabase RLS  
Production truth policy: fail closed

## Purpose

Urban Twin is the canonical spatial registry that connects physical entities to existing ATLAS systems without duplicating their sources of truth.

Hierarchy:

`district → site → building → floor → space → asset/infrastructure`

## Data contracts

- `atlas_urban_twin_entities`: canonical hierarchy, geometry/location references and explicit verification state.
- `atlas_urban_twin_bindings`: references to external authoritative systems such as CleanScan 3D, Device OS, GPS 4D, Work, sensors and facility adapters.
- `atlas_urban_twin_observations`: server-ingested telemetry, status, location, inspection and maintenance evidence.

All rows use the ATLAS dual-scope convention `tenant_id + org_id`, constrained to the same organization for the current tenancy model.

## Truth model

- `simulation` is never equivalent to live.
- `unverified` bindings do not activate physical capability.
- `verified` requires explicit adapter verification and evidence.
- Observations distinguish `simulation` from `authenticated` provenance.
- The browser receives read-only access; mutations and telemetry ingestion remain server-controlled.

## Module ownership

Urban Twin does not replace:

- GPS 4D for navigation/location intelligence.
- Device OS for physical device trust and control.
- ATLAS Work for work orders and field execution.
- CleanScan 3D for scan capture and spatial model generation.
- Inventory for stock ownership/cost state.
- ATLAS Network/Connect for communications and connectivity.

Urban Twin stores relationships and verified evidence references between those systems and physical entities.

## First production state

The repository can legitimately contain zero entities, zero bindings and zero observations. An empty state means the foundation is available but no real physical twin has been registered. The UI must never replace an empty repository with fabricated operational metrics.

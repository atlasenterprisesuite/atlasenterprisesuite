# ATLAS Wireless — Owned Network Foundation

Status: foundation implemented in source; physical RF/network deployment not yet verified.

## Objective

ATLAS Wireless is the canonical service provider. The long-term target is to operate an ATLAS-owned access network rather than depend permanently on an external mobile carrier.

The architecture separates:

- **service provider:** ATLAS Wireless
- **network mode:** `atlas-owned`, `hybrid`, or `wholesale-fallback`
- **radio/access network:** ATLAS RAN where ATLAS owns or lawfully operates the radio footprint
- **fallback network:** optional wholesale/MVNO connectivity while owned coverage is incomplete

This separation allows ATLAS to become progressively facilities-based without falsely claiming nationwide infrastructure before it exists.

## Phase 1 — ATLAS private 5G laboratory

Build one controlled ATLAS-owned site with:

- 5G Standalone core;
- one or more compatible 5G NR radios/small cells;
- CBRS-capable spectrum path or another lawfully authorized test band;
- Spectrum Access System coordination when CBRS requires it;
- fiber or equivalent backhaul;
- local edge compute;
- observability, logging and audit;
- lab SIM/eSIM subscriber identities;
- isolated test devices.

The lab gate is represented by `labReady`. It requires verified evidence for core, RAN, spectrum, backhaul and observability.

A lab-ready state is **not** authority to offer public mobile service.

## Phase 2 — ATLAS owned metro network

Expand from a single lab site into a controlled Orlando-area footprint:

1. Site inventory and RF design.
2. Spectrum-access evidence per site.
3. Redundant backhaul.
4. Multiple RAN sites with handoff validation.
5. ATLAS 5G core high availability.
6. Subscriber identity and policy control.
7. Voice/SMS/interconnect strategy.
8. Emergency-services integration and testing.
9. Network monitoring, incident response and lawful governance.
10. Only after verified evidence: customer pilot.

## Phase 3 — facilities-based commercial service

Commercial public activation remains blocked until every public-service layer is verified:

- core;
- RAN;
- spectrum authority/access;
- backhaul;
- observability;
- SIM/eSIM;
- interconnect;
- emergency services.

The source contract refuses `technicalPublicReady` if any required layer is missing, unverified, stale, cross-organization, duplicated or lacks a nonblank organization-scoped evidence reference. Technical readiness alone is not public launch authority.

## Spectrum strategy

ATLAS should not assume that owning radios equals owning spectrum.

For the first owned-network build, CBRS is a practical U.S. pathway because the 3.5 GHz band supports licensed-by-rule General Authorized Access and Priority Access Licenses. The exact legal/technical operating model must be verified for each site and service before RF activation.

ATLAS records spectrum access as one of:

- `cbrs-gaa`
- `cbrs-pal`
- `licensed`
- `experimental`

Every spectrum resource must carry an authority/reference and evidence. `ready` without evidence is rejected by the readiness evaluator.

## Core architecture

Target architecture: 5G Standalone.

Minimum logical functions:

- AMF
- SMF
- UPF
- UDM/AUSF subscriber/authentication functions
- PCF/policy layer
- secure subscriber data
- DNS/NTP/network services
- observability and audit
- redundant control-plane and user-plane paths before production

The current repository foundation models the core as a governed resource. It does not claim that these network functions are physically running yet.

## RAN architecture

Each ATLAS RAN site records:

- organization scope;
- latitude/longitude;
- radio technology;
- spectrum access model;
- readiness state;
- evidence references.

A RAN site must never be marked ready solely because hardware was ordered or configured. Commissioning evidence is required.

## Backhaul

ATLAS-owned radio sites require reliable IP transport to the core. Supported planned media include:

- fiber;
- Ethernet;
- microwave;
- fixed wireless;
- satellite.

Production sites should prefer redundant paths where economically and technically practical.

## SIM/eSIM

The owned-network architecture keeps SIM/eSIM distinct from radio ownership.

ATLAS must control or contract the subscriber identity/profile lifecycle appropriate to the deployed network. A web UI, activation reference or configured secret cannot substitute for verified subscriber-profile infrastructure.

## Emergency and public-service boundary

Public service is a separate gate from private/lab operation.

ATLAS must not enable `technicalPublicReady` until emergency-services obligations and the required network/interconnect evidence are verified. Final activation separately requires current commercial/regulatory launch authorization, billing/tax readiness, staging verification and end-to-end evidence.

## Hybrid transition

ATLAS may operate in `hybrid` mode during build-out:

- ATLAS-owned network where coverage exists;
- wholesale/fallback roaming or MVNO connectivity elsewhere.

The fallback must remain logically separate from claims about owned RF coverage. Hybrid and wholesale-fallback modes also remain blocked until the existing MVNO/provider readiness gate is verified.

## Repository implementation

The first owned-network foundation consists of:

- `supabase/functions/_shared/atlas-wireless-network.ts`
  - owned/hybrid/fallback modes;
  - RAN/site contracts;
  - core profile;
  - spectrum authorization;
  - backhaul resources;
  - fail-closed lab/technical-public readiness evaluation;
  - tenant-scoped evidence, duplicate rejection and freshness enforcement;
  - final activation gate that recomputes readiness and requires commercial/regulatory launch authorization.
- `supabase/migrations/20260925174500_atlas_wireless_owned_network_permissions.sql`
  - explicit network infrastructure RBAC.
- `tests/unit/atlas-wireless-owned-network.test.ts`
  - lab-vs-public boundary;
  - spectrum evidence requirement;
  - public-service fail-closed enforcement.

## Definition of done for the first physical ATLAS site

The first site is not ✅ until ATLAS has authenticated evidence for all of the following:

1. physical site;
2. commissioned radio;
3. lawful spectrum access;
4. active SAS coordination when applicable;
5. reachable ATLAS core;
6. working backhaul;
7. test subscriber identity;
8. device attach/session;
9. data path;
10. observability;
11. emergency/public-service boundary documented;
12. no unsupported claim of public commercial readiness.

This foundation creates the control model for ATLAS-owned infrastructure. Physical procurement, RF installation, spectrum/SAS onboarding and site commissioning remain external execution steps and must be evidenced before production status is promoted.

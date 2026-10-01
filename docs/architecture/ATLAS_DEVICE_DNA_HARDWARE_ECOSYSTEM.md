# ATLAS Device DNA and Hardware Ecosystem

Status: approved product direction; software architecture only unless specific hardware evidence is attached.

## Purpose

ATLAS Device OS is the canonical software control plane. The hardware program extends that existing module rather than creating a parallel product architecture.

The product rule is:

`POWER -> DEVICE DNA -> HARDWARE CHECK -> SECURITY CHECK -> ADAPTIVE PROFILE -> OS -> ATLAS`

If normal boot cannot continue:

`POWER -> DEVICE DNA -> FAILURE DETECTED -> PHOENIX MODE -> DIAGNOSE -> REPAIR -> VERIFY -> BOOT`

## Product family

- ATLAS Device DNA: hardware identity, capability and readiness contract.
- ATLAS Phoenix: independent recovery environment.
- ATLAS Rescue Key: portable authorized rescue environment.
- ATLAS Core: modular compute and identity core.
- ATLAS Shell: long-life laptop chassis around replaceable compute.
- ATLAS Neural Dock: context-aware governed workspace dock.
- ATLAS Halo: ambient assistant with physical privacy disconnects.
- ATLAS Vision: spatial assistance for real operational workflows.
- ATLAS FieldPad: rugged offline-first enterprise tablet.
- ATLAS Mesh Nodes: local-first site coordination.
- ATLAS Adaptive Computing: runtime selection from constrained hardware through high-performance systems.

## Truth boundary

A browser UI cannot prove firmware, storage health, secure-element status, battery telemetry, radios or sensors. Those states remain unavailable until a signed native adapter reports them through an authenticated ATLAS device session.

No hardware concept may be labeled connected, production-ready or verified based solely on design approval.

## Adaptive profiles

- Lite: constrained devices. Prioritize core navigation, assistant text, business workflows and low-memory execution.
- Standard: general-purpose desktop/laptop operation.
- Performance: high-memory/high-core systems with locally verified acceleration.

The initial classifier is deterministic and testable, but it accepts declared values only. A later native adapter may supply evidence-backed telemetry.

## Prototype sequence

1. Reuse the existing ATLAS Device OS control plane.
2. Define the Device DNA signed telemetry schema.
3. Build a Linux reference agent for authorized hardware inventory.
4. Build Phoenix as a bootable recovery image in a disposable lab environment.
5. Validate read-only diagnostics before any repair operation.
6. Add signed repair actions with explicit authorization and audit events.
7. Prototype Rescue Key hardware.
8. Evaluate Core/Shell interconnect, thermal and repairability constraints.
9. Extend to FieldPad, Halo, Vision and Mesh only after the shared trust model is proven.

## Security requirements

- Secure boot compatibility and signed updates.
- Hardware-backed identity where supported.
- No secret extraction from devices.
- Tenant and organization isolation for enterprise enrollment.
- Explicit authorization before destructive repair, disk write, re-image or credential reset.
- Append-only audit events for diagnostics and repair actions.
- Offline actions must reconcile safely before cloud synchronization.

## Definition of done for the first physical milestone

The first milestone is not a commercial laptop. It is a verified reference path that can inspect one authorized Linux device, produce an evidence-backed Device DNA report, classify its ATLAS runtime profile, and enter Phoenix diagnostics without inventing hardware state.

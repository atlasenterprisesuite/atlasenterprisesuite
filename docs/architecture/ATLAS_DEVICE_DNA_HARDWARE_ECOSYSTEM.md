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

A browser UI cannot prove firmware, storage health, secure-element status, battery telemetry, radios or sensors. The first native reference path is Linux Local Agent Device DNA v1, which reports bounded read-only observations through an authenticated ATLAS agent session. Its content digest is integrity evidence, not hardware attestation; TPM/manufacturer-backed attestation remains a later gate.

No hardware concept may be labeled connected, production-ready or verified based solely on design approval.

## Adaptive profiles

- Lite: constrained devices. Prioritize core navigation, assistant text, business workflows and low-memory execution.
- Standard: general-purpose desktop/laptop operation.
- Performance: high-memory/high-core systems with locally verified acceleration.

The initial classifier remains deterministic and testable. The web estimator accepts declared values only, while the Linux reference agent can now supply agent-observed Device DNA v1 evidence. Performance still requires separately verified local-AI capability; Device DNA does not infer that from RAM/CPU alone.

## Prototype sequence

1. Reuse the existing ATLAS Device OS control plane.
2. Define the Device DNA v1 evidence schema, privacy exclusions and deterministic content digest. ✅ Software implemented.
3. Build a Linux reference agent for authorized read-only hardware inventory and wire it to Device OS. ✅ Software implemented; physical-device validation still required.
4. Add cryptographic hardware attestation only where the platform can prove it; do not label the v1 digest as a hardware signature.
5. Build Phoenix as a bootable recovery image in a disposable lab environment.
6. Validate read-only Phoenix diagnostics before any repair operation.
7. Add signed repair actions with explicit authorization and audit events.
8. Prototype Rescue Key hardware.
9. Evaluate Core/Shell interconnect, thermal and repairability constraints.
10. Extend to FieldPad, Halo, Vision and Mesh only after the shared trust model is proven.

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

## Device DNA v1 evidence contract

The Linux reference collector is intentionally conservative. It may report only bounded facts that can be observed without destructive actions or secret extraction:

- CPU model, logical cores, total memory, architecture and kernel release;
- manufacturer/product family when exposed by DMI;
- boot mode, Secure Boot state when readable, and TPM presence;
- bounded storage inventory from sysfs without serial numbers;
- battery presence/state/capacity when available;
- deterministic ATLAS runtime profile;
- SHA-256 digest of the normalized report.

The v1 privacy boundary excludes serial numbers, product UUIDs, MAC addresses, IP addresses, usernames, hostnames and mount paths.

Evidence semantics are explicit:

- `agent-observed`: collected by an enrolled ATLAS Local Agent.
- `hardware_attested: false`: the v1 report is not a TPM quote, OEM attestation or secure-element signature.
- `content_digest_sha256`: integrity checksum only.
- `health_status: unknown`: Device DNA inventory does not claim SMART, battery-health, malware-free or component-health certification.

## First milestone acceptance criteria

Software acceptance requires all of the following:

1. Linux collector produces `atlas.device-dna.v1` without privileged destructive commands.
2. The Local Agent registers `device-dna-linux` with read-only capability `device.dna.read`.
3. Device OS displays only reports actually returned by the Local Control Plane.
4. A refresh command writes an auditable `device.dna.observed` event.
5. Automated tests verify classification, privacy boundaries and non-attestation semantics.
6. Repository CI/typecheck/build gates pass.

Physical acceptance remains separate: one authorized Linux machine must run the released Local Agent and return a real Device DNA report before the physical milestone can be marked complete.


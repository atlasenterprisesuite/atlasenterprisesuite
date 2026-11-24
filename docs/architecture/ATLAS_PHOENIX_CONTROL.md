# ATLAS Phoenix Control — 777 REVIEW

Status: staged on existing Device OS / Local Control Plane and Remote Assist PR #923. P0 NO-GO for OS boot, unattended remote access and automatic binary updates.

## Reuse

Existing Windows Local Agent installer registers an automatic startup SYSTEM task with bounded process restarts. Existing organization-scoped Local Control Plane provides authenticated device/agent inventory, mTLS state, command queuing and audit. ATLAS Device DNA already defines the Phoenix sequence: detect → diagnose → repair → verify → boot. No duplicate scheduler, identity provider, queue or remote bus is introduced.

## Operational v0 button

PhoenixControlPanel displays the live inventory and queues **only** `http-health` + `health.check` + `status.read` to a same-organization online, mTLS-active agent. Backend authorization remains authoritative. Actual command state is read via `commands.list`, never inferred from queue delivery. An offline or revoked agent cannot be contacted by a web button; a powered-off machine cannot be remotely powered on here.

## Update / recovery contract — NOT yet active

1. Verify identity/org/RBAC/MFA, device binding, user authorization and active signed native adapter.
2. Resolve signed artifact from an approved source, exact source SHA and cryptographic manifest with immutable digest.
3. Require green CI exact SHA, tenant isolation, revision provenance, independent review and approval for risky changes.
4. Prepare an isolated staging directory and verified last-known-good version; preserve protected device state.
5. Apply a bounded, versioned update via local signed adapter; forbid arbitrary remote shell or destructive operations.
6. Confirm service health, audit persistence, exact release SHA and two-device E2E.
7. On failure, restore last-known-good image, verify rollback and record a terminal error after bounded attempts.
8. Never auto-retry invalid signatures, revoked consent, cross-tenant grants or unaudited actions. P0 blocks merge and deployment.

Acceptance: Windows physical boot/restart proof, signed updater/recovery adapter, negative tests, atomic audit, exact-SHA CI, independent review, production verification. No signed updater, operating-system recovery, or deployment is implied by the presence of this UI.

# ATLAS Remote Assist

ATLAS Remote Assist extends the existing Device OS and Local Control Plane. It is not a parallel remote-access product and must not create a second identity, session, audit, or device registry.

## Current production truth

The canonical executable remote automation path already present in ATLAS is the Local Agent `browser-cdp` adapter for governed browser actions. Full desktop screen viewing and keyboard/mouse control are **not** considered active unless a native adapter reports explicit capabilities and passes the existing ATLAS security gates.

Microsoft Quick Assist may be used manually by an authorized user as an external fallback. It is outside the ATLAS trust boundary and ATLAS must not claim that a Quick Assist session is an ATLAS-managed session.

## Required trust chain

A native Remote Assist session is eligible to become active only when all of these are true:

1. The device is enrolled through ATLAS Local Control Plane.
2. The Local Agent is online.
3. The agent has an active mTLS certificate binding.
4. The device registers a signed native remote-desktop adapter.
5. The adapter declares only the capabilities it really supports:
   - `remote.desktop.view`
   - `remote.desktop.control`
6. Tenant and organization scope match the active ATLAS session.
7. RBAC allows the requested operation.
8. Interactive consent or an explicitly governed unattended-access policy exists.
9. High/critical operations are bound to the canonical ATLAS Approval Center.
10. Session creation, capability use, revocation, failure, and termination are appended to the existing audit stream.

Failure of any required gate is fail-closed.

## Session model

Remote sessions must be short-lived and revocable. No permanent master password, reusable public pairing code, or browser-stored machine credential is allowed.

A future native adapter should use:

- an ephemeral session identifier;
- a short expiration;
- explicit viewer/controller roles;
- visible local session state;
- immediate local and server-side revoke;
- bounded capability negotiation;
- transport encryption in addition to the existing mTLS control channel;
- no secret material in telemetry.

Unattended access, when eventually supported, must be an organization policy with device binding, scoped role permission, explicit enablement, expiration/review controls, and auditable revocation. It must never be silently enabled during enrollment.

## Transport boundary

The existing WSS+mTLS Local Agent bus remains the control plane for command references, policy, and audit. High-volume screen media should not be tunneled through the canonical command queue.

The native data plane should be provider-neutral and separately replaceable. A WebRTC-class encrypted media/data transport is the preferred architectural direction, but ATLAS must not report it as available until a real implementation is integrated and tested end-to-end.

## UX contract

Device OS must show evidence-derived states:

- Enrollment required
- mTLS required
- Native adapter required
- Evidence verified
- Unavailable

Do not show `Connected`, `Live`, `Ready`, or `Unattended access enabled` based on configuration alone.

## Windows bootstrap

The existing Windows Local Agent installer remains the canonical bootstrap:

`tools/local-agent/install-windows.ps1`

It runs as a SYSTEM startup scheduled task with restricted ACLs and uses the same enrollment/session/mTLS infrastructure as the rest of Local Control Plane.

A future Windows native Remote Assist adapter must be implemented as a separately testable capability extension. It must not weaken the current Local Agent permission, secret, or audit boundaries merely to achieve desktop control.

## Verification

Minimum tests for a native adapter before production activation:

- no capability is advertised when the native runtime is absent;
- view-only and control permissions are distinct;
- consent denial blocks the session;
- expired/revoked sessions cannot reconnect;
- mTLS mismatch blocks control-plane access;
- org/tenant mismatch fails closed;
- control cannot be requested through a view-only session;
- keyboard/mouse input is rejected without the declared capability;
- session termination revokes data-plane access;
- no passwords, OTPs, access tokens, pairing secrets, or private keys enter audit telemetry;
- Windows lock/UAC/secure-desktop boundaries are handled truthfully;
- responsive Device OS states remain accurate on desktop/tablet/mobile;
- P0 production verification does not label Remote Assist ready without actual end-to-end evidence.

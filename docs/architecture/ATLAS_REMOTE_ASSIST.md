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

## 2026-10-12 — Browser Screen Share pilot (separate from native adapter)

The existing `RemoteAssistPanel` now embeds an **opt-in, peer-to-peer browser screen-sharing pilot**. This does not change native `remote.desktop.view`/`remote.desktop.control` capability eligibility or the Local Agent's mTLS, RBAC, approval and audit rules.

User-visible pilot:
- The presenter deliberately checks consent and clicks **Choose screen and create invitation**. `getDisplayMedia({video, audio:false})` opens the browser-native screen/window picker. Nothing is captured on page load.
- The browser creates an ephemeral WebRTC offer (DTLS/SRTP media transport). The user copies the single-use signaling blob through a trusted **out-of-band** channel to the invited viewer. The viewer checks consent and returns a WebRTC answer; the presenter explicitly accepts it.
- Signaling blobs contain peer ICE addresses, SDP, DTLS fingerprint, session ID and a ten-minute pairing deadline. They are held in ephemeral React memory only, not uploaded to ATLAS, persisted, sent to analytics or written to audit logs. Do not paste them into tickets or public messaging.
- The browser screen track is stopped when the user revokes sharing, closes the page, or the 30-minute safety timer expires. The explicit Stop button closes the WebRTC peer, stops local tracks, clears visible pairing data and resets state.
- A public Google STUN server is **optional** and off by default; turning it on may expose network metadata to that provider. No TURN relay is deployed, so internet/NAT traversal is not guaranteed.
- **No data channel, input injection, arbitrary command execution, file transfer, recording, unattended access, remote desktop adapter or native OS control** is implemented by this pilot. The viewer could still independently capture a viewed screen. Operators must hide sensitive content before sharing.

Security limitations **not papered over**:
1. Manual out-of-band message exchange authenticates neither the remote user nor organizational tenant; both participants must verify each other's identities via a trusted independent channel. The pilot is **not a Zero Trust enterprise Remote Desktop session** and must never be classified as native Remote Assist `ready`.
2. Device OS uses ATLAS page/session access, but direct WebRTC peer IDs are not cryptographically bound to ATLAS organization RBAC or audited in a server-side session ledger. Therefore deployment may only be labeled **browser view-only pilot**.
3. The feature is unsuitable for unattended support, privileged administration or regulated data until authenticated signaling, identity binding, backend authorization, session audit and revocation are implemented and independently verified.
4. The existing mTLS native-agent status remains in its own readiness section, unchanged. Local Agent `browser-cdp` browser automation is a separate governed command path.

Next stage for TeamViewer-class remote desktop: authenticated room/signaling service with RLS and session audit; local explicit consent and independent revocation; native signed Windows/Ubuntu/macOS capture/input adapter behind Local Control Plane, screen lock/UAC boundaries, configurable TURN/TLS relay, per-action approval and E2E exact-SHA evidence. Reuse canonical ATLAS identity and execution; never create an independent password or unaudited resident agent.

Status: implementation added to a PR branch with focused tests. **Neither browser pilot nor native desktop support is declared production-verified** until all required build, security, CI and actual two-device connectivity checks pass.

## 2026-10-13 — Authenticated view-only room implementation (PR #788 extension)

The **manual unauthenticated peer** limitation described in the initial 2026-10-12 pilot section above is now addressed **in branch code only**, not in deployed production. Existing native Local Agent capability gates remain completely separate.

- `supabase/migrations/20261013181500_atlas_remote_assist_authenticated_rooms.sql` defines a service-role-only RLS table and one security-definer transactional room/audit RPC.
- `supabase/functions/atlas-remote-assist/index.ts` verifies each Supabase JWT, active organization membership, and owner/admin role before invoking the service RPC. User-controlled org IDs alone cannot grant access.
- Room lifecycle: **create → viewer joins → host explicitly approves identified viewer → viewer submits answer digest → host verifies digest and activates → stop/revoke/expire**. Either party may end a session.
- The server persists room state, participant IDs, SHA-256 offer/answer digests and timestamps, **never SDP, ICE candidates, images, audio, private keys or reusable pairing secrets**. Every state mutation includes a canonical `audit_logs` event in the same SQL transaction; no audit means rollback.
- Both memberships, current roles, scope and expiry are rechecked for every room request. The UI polls authorization every four seconds while connected, then closes all local tracks on any denied/revoked/expired/failed authorization response. It never connects to a viewer whose SDP digest lacks that viewer's authenticated approval flow.
- The browser renders the actual viewer user ID for the host to confirm via the existing ATLAS Team directory before clicking **Approve viewer**. Until that explicit click, no WebRTC answer is generated.
- Screen capture is always subject to a native browser permission prompt, session expiry, visible controls and explicit stop. Remote keyboard/mouse and file transfer remain **unavailable**. Optional STUN does not provide a TURN relay.

**Production blockers P0 remain:** this table and function are not deployed merely by committing migration/configuration; the new Edge API must be deployed and verified against the exact schema, followed by authenticated **two-device** tests covering consent denial, member role revocation, session hijack/forged SDP, TLS/DTLS, stop/reconnect denial, browser/background tab behavior and production exact-SHA checks. No release or native-desktop-ready status should be claimed until evidence exists. Do not publish the earlier unauthenticated pilot as an enterprise remote-control feature.

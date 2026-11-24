# ATLAS Universal Media — un software, múltiples experiencias
**Architecture decision:** use ATLAS Studio, Creator Library, Identity and Device OS. No parallel product, identity store, device registry, or provider credential vault.

**Status (2026-11-12):** Foundation proposal on a dedicated branch. No production deployment, real device pairing, media synchronization, live account integration, or distributed playback is claimed.

## User outcome and sequence

1. **First usable experience:** choose legitimate user-owned/authorized audio files on a Windows laptop; listen using the existing browser-local `/studio/mix` engine, with explicit player states and accessible controls. Existing local files stay in that browser; browser-local object URLs are not shareable with an iPhone.
2. **Next:** pair an iPhone with the Windows ATLAS Local Agent using explicit enrollment, device confirmation, and revocable permission. Send *control references* (play, pause, stop, next, volume) to a laptop player that is actually running. Do not tunnel audio or tokens through the command queue.
3. **Then:** add separately authorized cross-device media transfer and compatible protocols; only where source licenses and technical capabilities permit. Distinguish transfer, handoff and simultaneous playback.
4. **Optional:** provider-specific Spotify or future connectors operate behind independent policies. Spotify rights, playback limitations and permissions cannot be derived from ATLAS's generic media policy.

## Verified reuse (repository inspection)

- Existing `/studio/mix` route and `apps/web/src/modules/creator/music/LocalDJMixPage.tsx`: local file import, in-browser playback and crossfade; not a network media service.
- Creator Library and music/video creation routes already exist, but readiness varies by provider.
- Device OS Local Control Plane: organization-scoped enrollment, registered devices, permission-based command routing and auditing. The design explicitly forbids blind subnet discovery and arbitrary command payloads.
- Spotify Companion, PKCE utilities and injected-token Connect transport in **draft PR #1031**. No connected Spotify account or live device control is evidenced. Keep independent of this universal media foundation.
- AI Universe routes and provider gates already define a single identity/organization boundary and truthful capability/readiness display.

## Component boundaries

```text
ATLAS app (mobile / laptop) — authenticated Identity + organization
                  |
             Media Session UI
                  |
         packages/media/session.ts
        pure fail-closed policy gate
                  |
          ATLAS command executor          (future; not implemented here)
                  |
     Existing Device OS command / audit plane
                  |
   Enrolled Windows Local Agent + real player
                  |
     Physical output / laptop speaker
```

Provider adapters (Spotify, AirPlay, etc.) are *separate optional boundaries*, not interchangeable sources of unrestricted content or vendor-specific rights.

### Foundation contract added by this PR

`authorizeMediaCommand(input)` evaluates:

- Actor, session and target must share one authenticated organization; content permissions and cross-tenant access are never inferred.
- Actor must have `media.session.control`, and either own the session or also have `media.session.admin`.
- Caller must supply the expected session version. Stale commands fail closed.
- Source usage rights must be affirmatively verified, and separate remote-playback rights are required when a remote target is supplied.
- A transfer requires one target. The target must be enrolled, online, explicitly selected, consented and capability-compatible.
- Unknown actions, invalid identities and invalid data are rejected; denial returns an explicit typed reason.
- This pure function is **not itself an authentication, copyright-validation, rights registry, persistence system, device command executor or Spotify license grant**. Trusted server-side boundaries must provide input values; never accept browser-supplied booleans as proof of rights, enrollment, or consent.

## Proposed follow-on contract (NOT implemented)

- `atlas_media_sessions`: organization id, actor/owner, source asset ref, license assertion ref, target device ref, monotonic version, lifecycle, expires_at. Row-level security mandatory.
- `atlas_media_commands`: opaque idempotency key, session reference, expected version, action, explicit target, request metadata and acknowledgement state. No raw arbitrary payload, source media bytes, tokens or private URLs.
- ATLAS execution event references: issue, approve (if high-risk), claim, acknowledge, verify **real observed playback state**, fail/expire and revoke.
- Native Windows Local Agent: signed/enrolled binary, scoped transport (authenticated secure channel), user-visible pairing with short expiry and revocation, no unauthorised network scans. Distinguish device online from player ready.
- iPhone: responsive browser experience first; native background controls only with platform-entitled implementation and verification.
- Browser-local files: no automatic upload. Remote streaming requires separate user choice, legitimate rights, verified secure media transport and access revocation.
- Device discovery protocols must be restricted to user-authorized equipment. AirPlay and Spotify Connect are governed by their own platform rules.

## ATLAS 777 REVIEW: gates

**P0 / fail closed**
- Negative tests: cross-tenant identity/session/target; delegated control; missing permission; stale version; missing rights; unpaired/offline/unsupported target.
- TS typecheck, Vitest and build on **exact current PR SHA**. Security, accessibility and protected CI checks must pass.
- Integration tests must prove server-generated auth context and RLS deny-rows; client-supplied flags never bypass policy.
- Real laptop-iPhone pairing, audio playback and remote command acknowledgement with explicitly enrolled devices; permission/revocation and concurrent ownership test.
- Provider-specific rights/policy check before any remote/media provider call. No automatic token exchange, billing, bypass of DRM or unlicensed streaming.
- Manual responsive + screen-reader/keyboard review, secrets scan, observability and service rollback plan.
- No merge or production deploy until project-wide P0 and separate release authorization.

**P1 / document**
- Offline/reconnect UX, latency and jitter targets after first device test, volume normalization, format support matrix, optional cross-platform targets.

## Acceptance ledger

| Feature | State | Evidence |
| --- | --- | --- |
| Existing laptop local DJ | Existing repo source | `LocalDJMixPage.tsx` |
| Generic session authorization logic | Proposed code in this branch | `packages/media/session.ts` |
| Fail-closed negative unit tests | Proposed, CI pending | `tests/unit/atlas-media-session-policy.test.ts` |
| iPhone remote control of Windows laptop | NOT IMPLEMENTED | Must build pair + agent adapter + real E2E |
| Spotify live account / playback | NOT CONNECTED | PR #1031 separate AUTH boundary |
| Deploy/merge | NOT AUTHORIZED / NOT DONE | Must satisfy exact-SHA P0 |

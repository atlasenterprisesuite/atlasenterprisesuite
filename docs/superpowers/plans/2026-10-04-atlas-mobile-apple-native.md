# ATLAS Apple Native Mobile Bridges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add focused Apple-native capability and StoreKit bridges that can prove iPhone/iPad runtime capabilities to ATLAS without creating a parallel product architecture or claiming native readiness from web code.

**Architecture:** Follow the repository's existing Swift Package bridge pattern (`apple-navigation-bridge`, `apple-personal-voice-bridge`). Add one general Apple mobile-capability bridge for runtime/permissions/haptics/share/deep-link primitives and a separate StoreKit bridge for entitlement/restore evidence. A dedicated `apps/ios` host remains out of scope until a real host/runtime integration is available and device verification proves the need.

**Tech Stack:** Swift Package Manager, Swift, Apple platform frameworks as availability-gated, XCTest/Swift Testing according to existing package style, shared ATLAS mobile JSON contracts.

**Spec:** `docs/superpowers/specs/2026-10-04-atlas-mobile-experience-design.md`

## Global Constraints

- Native capability is never inferred from Safari/iPadOS browser user-agent strings.
- Apple APIs are availability-gated; unsupported OS/framework states return explicit unsupported evidence.
- StoreKit receipts/transaction verification material never enters browser logs or UI payloads.
- Restore/purchase actions do not report success until StoreKit/provider evidence is verified.
- Existing `apple-navigation-bridge` and `apple-personal-voice-bridge` remain canonical for their current responsibilities.
- This plan does not create a full iOS application shell or duplicate ATLAS auth/business logic.

## Review Focus

- Framework/API unavailable on older supported device -> bridge compiles and returns unsupported instead of crashing.
- Permission state is `.notDetermined` -> normalized `not_determined`, never granted.
- Restore returns no current entitlement -> do not retain a previous optimistic `active/restored` label.
- Deep link target is not an allowlisted ATLAS route -> reject rather than open an arbitrary URL.
- Native host cannot provide authenticated ATLAS account scope -> StoreKit evidence remains unattached/unverified for ATLAS billing state.

---

### Task 1: Preserve and test existing Apple bridge boundaries

**Files:**
- Reuse: `native/apple-navigation-bridge/Package.swift`
- Reuse: `native/apple-navigation-bridge/Sources/AtlasAppleNavigationBridge/AtlasAppleNavigationBridge.swift`
- Reuse: `native/apple-navigation-bridge/Tests/*`
- Reuse: `native/apple-personal-voice-bridge/Package.swift`
- Reuse: `native/apple-personal-voice-bridge/Sources/AtlasAppleVoiceBridge/*`
- Reuse: `native/apple-personal-voice-bridge/Tests/*`
- Test: add focused regression tests only where existing coverage is missing.

**Interfaces:**
- Consumes: current navigation and personal-voice bridge public APIs.
- Produces: regression evidence that new mobile bridges do not absorb or duplicate their responsibilities.

- [ ] **Step 1: Run** `swift test --package-path native/apple-navigation-bridge` and record the baseline result.
- [ ] **Step 2: Run** `swift test --package-path native/apple-personal-voice-bridge` and record the baseline result.
- [ ] **Step 3: Add failing regression tests only if** a current bridge lacks an explicit unsupported/error boundary required by the mobile spec.
- [ ] **Step 4: Make minimal corrections** in the owning bridge; do not move APIs between packages for style alone.
- [ ] **Step 5: Re-run both Swift package tests** and require PASS before adding new packages.
- [ ] **Step 6: Commit any required regression fix** as `fix: preserve Apple bridge capability boundaries`.

### Task 2: Add Apple mobile capability bridge

**Files:**
- Create: `native/apple-mobile-bridge/Package.swift`
- Create: `native/apple-mobile-bridge/Sources/AtlasAppleMobileBridge/AtlasAppleMobileBridge.swift`
- Create: `native/apple-mobile-bridge/Sources/AtlasAppleMobileBridge/AtlasApplePermissionState.swift`
- Create: `native/apple-mobile-bridge/Sources/AtlasAppleMobileBridge/AtlasAppleRuntimeSnapshot.swift`
- Create: `native/apple-mobile-bridge/Tests/AtlasAppleMobileBridgeTests/AtlasAppleMobileBridgeTests.swift`

**Interfaces:**
- Produces: `AtlasAppleRuntimeSnapshot`, `AtlasApplePermissionState`, `AtlasAppleMobileBridge.runtimeSnapshot()`, `permissionState(for:)`, `performHaptic(_:)`, `shareCapabilityState`, `deepLinkCapabilityState`.
- Consumes: Apple runtime APIs only; no ATLAS credentials or business logic.

- [ ] **Step 1: Write failing Swift tests** for phone/tablet runtime classification, unsupported permission type, not-determined state, unavailable framework and deterministic JSON-safe enum values.
- [ ] **Step 2: Run** `swift test --package-path native/apple-mobile-bridge` and verify FAIL because the package/API does not exist.
- [ ] **Step 3: Implement** value types and `runtimeSnapshot()` using platform idiom/device class plus explicit bridge provenance.
- [ ] **Step 4: Implement** read-only permission-state observation for the approved permission set; request APIs remain separate from observation.
- [ ] **Step 5: Add** haptic/share/deep-link capability probes behind platform availability checks; capability probes must not perform the action.
- [ ] **Step 6: Run** Swift tests and verify PASS.
- [ ] **Step 7: Commit** `feat: add Apple mobile capability bridge`.

### Task 3: Add explicit permission request and native action APIs

**Files:**
- Modify: `native/apple-mobile-bridge/Sources/AtlasAppleMobileBridge/AtlasAppleMobileBridge.swift`
- Create: `native/apple-mobile-bridge/Sources/AtlasAppleMobileBridge/AtlasApplePermissionRequest.swift`
- Modify: `native/apple-mobile-bridge/Tests/AtlasAppleMobileBridgeTests/AtlasAppleMobileBridgeTests.swift`

**Interfaces:**
- Produces: `requestPermission(_:) async -> AtlasApplePermissionState`, `performHaptic(_:) throws`, `validatedDeepLink(_:) -> URL?`.
- Consumes: only permission/action types already declared in Task 2.

- [ ] **Step 1: Write failing tests** for unsupported request, denied result, idempotent already-granted observation and deep-link allowlist rejection.
- [ ] **Step 2: Implement** permission requests by type with Apple availability checks; no permission is requested by merely reading settings.
- [ ] **Step 3: Implement** `validatedDeepLink()` accepting only canonical ATLAS route/deep-link schemes configured by the eventual host.
- [ ] **Step 4: Implement** haptics as an explicit action that returns/throws truthful unsupported state.
- [ ] **Step 5: Run** Swift tests and verify PASS.
- [ ] **Step 6: Commit** `feat: add explicit Apple permission actions`.

### Task 4: Add isolated StoreKit entitlement bridge

**Files:**
- Create: `native/apple-storekit-bridge/Package.swift`
- Create: `native/apple-storekit-bridge/Sources/AtlasAppleStoreKitBridge/AtlasAppleStoreKitBridge.swift`
- Create: `native/apple-storekit-bridge/Sources/AtlasAppleStoreKitBridge/AtlasStoreKitEntitlement.swift`
- Create: `native/apple-storekit-bridge/Tests/AtlasAppleStoreKitBridgeTests/AtlasAppleStoreKitBridgeTests.swift`

**Interfaces:**
- Produces: `AtlasStoreKitEntitlement` containing product id, normalized state, observed timestamp, transaction identifier hash/reference safe for server verification, and `verificationState`.
- Produces: `currentEntitlements() async`, `restoreEntitlements() async`.
- Does not produce ATLAS `active_verified` until server/account association succeeds.

- [ ] **Step 1: Write failing tests** with injected StoreKit evidence provider doubles for verified current entitlement, revoked/expired entitlement, no entitlement, provider error and restore-without-entitlement.
- [ ] **Step 2: Run** `swift test --package-path native/apple-storekit-bridge` and verify FAIL.
- [ ] **Step 3: Implement** an injectable evidence source so tests do not depend on live App Store access.
- [ ] **Step 4: Implement** current/restore operations that preserve Apple verification result and never emit raw receipt/transaction secrets to UI-safe models.
- [ ] **Step 5: Run** Swift tests and verify PASS.
- [ ] **Step 6: Commit** `feat: add fail-closed StoreKit bridge`.

### Task 5: Define native-to-ATLAS bridge payload contract

**Files:**
- Create: `packages/mobile-experience/nativeBridge.ts`
- Modify: `packages/mobile-experience/index.ts`
- Test: `tests/unit/mobile-native-bridge.test.ts`
- Create: `docs/platforms/atlas-ios-native-bridge-contract.md`

**Interfaces:**
- Produces: `NativeBridgeEnvelope<T> = { bridge, version, capturedAt, payload, evidence }` and validators for runtime, permission and StoreKit bridge payloads.
- Consumes: JSON-safe payloads from Tasks 2-4.

- [ ] **Step 1: Write failing TypeScript tests** for valid payloads, wrong bridge version, unknown enum, missing evidence and spoofed `ios_native` payload with no bridge provenance.
- [ ] **Step 2: Implement** strict validators that reject malformed/spoofed native envelopes.
- [ ] **Step 3: Run** `npx vitest run tests/unit/mobile-native-bridge.test.ts` and verify PASS.
- [ ] **Step 4: Document** how a future native host passes bridge payloads into the ATLAS mobile gateway and how web surfaces fall back to `Requires ATLAS iOS app` when no authenticated bridge exists.
- [ ] **Step 5: Commit** `docs: define ATLAS native bridge contract`.

### Task 6: Native verification gate

**Files:**
- Modify only if verification identifies defects in Tasks 1-5.

**Interfaces:**
- Produces: source/test evidence only; device readiness remains unverified until tested on an actual supported Apple runtime.

- [ ] **Step 1: Run** all three Swift package test suites: navigation, personal voice, mobile bridge, plus StoreKit bridge.
- [ ] **Step 2: Run** `npx vitest run tests/unit/mobile-native-bridge.test.ts`.
- [ ] **Step 3: Run** repository `npm run typecheck` and `npm run build` after TypeScript contract integration.
- [ ] **Step 4: Confirm** web surfaces still label unavailable native actions `Requires ATLAS iOS app` or `Unavailable in this runtime`.
- [ ] **Step 5: Record** that source/tests do **not** prove physical-device permission, haptic, share, StoreKit or iPad drag/drop behavior.
- [ ] **Step 6: When an actual native host/device is available, verify** permission observations/requests, deep links, haptics/share and StoreKit evidence on-device before changing native readiness to verified.
- [ ] **Step 7: Commit verification fixes, if any** as `fix: close Apple mobile bridge verification gaps`.

# ATLAS Apple Personal Voice Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a testable native Apple adapter that requests Personal Voice authorization, enumerates authorized Personal Voices, and performs local speech playback without exporting or uploading the Apple voice.

**Architecture:** Implement the Apple integration as an isolated Swift package under `native/apple-personal-voice-bridge` so a native ATLAS iOS/macOS client can embed it without coupling the React web app to Apple-only APIs. Wrap AVSpeechSynthesizer behind protocols for deterministic tests, expose JSON-safe descriptors/capabilities to the host, and declare only local playback as supported unless later platform evidence proves otherwise.

**Tech Stack:** Swift, Swift Package Manager, AVFAudio / AVSpeechSynthesizer, XCTest, GitHub Actions macOS runner.

**Spec:** `docs/superpowers/specs/2026-09-06-atlas-personal-voice-design.md`

## Global Constraints
- Apple Personal Voice remains device-local.
- Do not upload, export, record, cache, or serialize generated Personal Voice audio.
- Read authorization from `AVSpeechSynthesizer.personalVoiceAuthorizationStatus`.
- Request authorization with `AVSpeechSynthesizer.requestPersonalVoiceAuthorization`.
- Enumerate authorized Personal Voices from `AVSpeechSynthesisVoice.speechVoices()` filtered by `.isPersonalVoice`.
- Playback uses `AVSpeechUtterance` plus `AVSpeechSynthesizer.speak`.
- Capabilities default to `localPlayback=true`, all export/stream/server/telephony flags false.
- Web remains `Requires ATLAS iOS app` until a native host embeds this bridge.
- Do not mark the bridge operational until a supported physical device with a real Personal Voice passes verification.

---

### Task 1: Create the Swift package and ATLAS-safe types

**Files:**
- Create: `native/apple-personal-voice-bridge/Package.swift`
- Create: `native/apple-personal-voice-bridge/Sources/AtlasAppleVoiceBridge/AppleVoiceTypes.swift`
- Create: `native/apple-personal-voice-bridge/Tests/AtlasAppleVoiceBridgeTests/ApplePersonalVoiceBridgeTests.swift`

**Produces:** `ApplePersonalVoiceAuthorization`, `ApplePersonalVoiceDescriptor`, `AppleVoiceCapabilities`.

- [ ] **Step 1: Write failing capability test**

```swift
import XCTest
@testable import AtlasAppleVoiceBridge

final class ApplePersonalVoiceBridgeTests: XCTestCase {
    func testAppleCapabilitiesAreLocalPlaybackOnly() {
        XCTAssertEqual(
            AppleVoiceCapabilities.personalVoice,
            AppleVoiceCapabilities(
                localPlayback: true,
                audioExport: false,
                realtimeStream: false,
                telephony: false,
                serverSynthesis: false
            )
        )
    }
}
```

- [ ] **Step 2: Create package definition and run failing test**

```swift
// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "AtlasAppleVoiceBridge",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "AtlasAppleVoiceBridge", targets: ["AtlasAppleVoiceBridge"])],
    targets: [
        .target(name: "AtlasAppleVoiceBridge"),
        .testTarget(name: "AtlasAppleVoiceBridgeTests", dependencies: ["AtlasAppleVoiceBridge"])
    ]
)
```

Run from `native/apple-personal-voice-bridge`: `swift test`

Expected: FAIL until source types exist.

- [ ] **Step 3: Implement exact DTOs**

```swift
public enum ApplePersonalVoiceAuthorization: String, Codable, Sendable {
    case authorized, denied, notDetermined, unsupported
}

public struct ApplePersonalVoiceDescriptor: Codable, Equatable, Sendable {
    public let identifier: String
    public let name: String
    public let language: String
}

public struct AppleVoiceCapabilities: Codable, Equatable, Sendable {
    public let localPlayback: Bool
    public let audioExport: Bool
    public let realtimeStream: Bool
    public let telephony: Bool
    public let serverSynthesis: Bool

    public static let personalVoice = AppleVoiceCapabilities(
        localPlayback: true,
        audioExport: false,
        realtimeStream: false,
        telephony: false,
        serverSynthesis: false
    )
}
```

- [ ] **Step 4: Run tests and commit**

Run: `swift test`

```bash
git add native/apple-personal-voice-bridge
git commit -m "feat: add Apple Personal Voice bridge package"
```

---

### Task 2: Abstract Apple framework calls behind a testable protocol

**Files:**
- Create: `native/apple-personal-voice-bridge/Sources/AtlasAppleVoiceBridge/AppleSpeechSystem.swift`
- Modify: bridge tests

**Produces:** `AppleSpeechSystem`, `AppleSpeechVoice`, `AppleSpeechAuthorizationState`.

- [ ] **Step 1: Add a fake-system test contract**

```swift
actor FakeAppleSpeechSystem: AppleSpeechSystem {
    var authorization: AppleSpeechAuthorizationState = .notDetermined
    var voices: [AppleSpeechVoice] = []
    var spoken: [(String, String)] = []

    func authorizationStatus() async -> AppleSpeechAuthorizationState { authorization }
    func requestAuthorization() async -> AppleSpeechAuthorizationState { authorization }
    func personalVoices() async -> [AppleSpeechVoice] { voices }
    func speak(text: String, voiceIdentifier: String) async throws {
        spoken.append((text, voiceIdentifier))
    }
}
```

- [ ] **Step 2: Run and verify failure**

Run: `swift test`

- [ ] **Step 3: Implement protocol**

```swift
public enum AppleSpeechAuthorizationState: Sendable {
    case authorized, denied, notDetermined, unsupported
}

public struct AppleSpeechVoice: Equatable, Sendable {
    public let identifier: String
    public let name: String
    public let language: String
}

public protocol AppleSpeechSystem: Sendable {
    func authorizationStatus() async -> AppleSpeechAuthorizationState
    func requestAuthorization() async -> AppleSpeechAuthorizationState
    func personalVoices() async -> [AppleSpeechVoice]
    func speak(text: String, voiceIdentifier: String) async throws
}
```

- [ ] **Step 4: Run tests and commit**

Run: `swift test`

```bash
git add native/apple-personal-voice-bridge
git commit -m "refactor: abstract Apple speech system for testing"
```

---

### Task 3: Implement real AVSpeechSynthesizer authorization and enumeration

**Files:**
- Create: `native/apple-personal-voice-bridge/Sources/AtlasAppleVoiceBridge/SystemAppleSpeechSystem.swift`
- Modify: bridge tests

**Produces:** `SystemAppleSpeechSystem`.

- [ ] **Step 1: Add pure authorization mapping tests**

Test all four Apple statuses: authorized, denied, notDetermined, unsupported.

- [ ] **Step 2: Run and verify failure**

Run: `swift test`

- [ ] **Step 3: Implement system adapter**

```swift
import AVFAudio

public actor SystemAppleSpeechSystem: AppleSpeechSystem {
    private let synthesizer = AVSpeechSynthesizer()

    public func authorizationStatus() async -> AppleSpeechAuthorizationState {
        mapAuthorization(AVSpeechSynthesizer.personalVoiceAuthorizationStatus)
    }

    public func requestAuthorization() async -> AppleSpeechAuthorizationState {
        await withCheckedContinuation { continuation in
            AVSpeechSynthesizer.requestPersonalVoiceAuthorization { status in
                continuation.resume(returning: mapAuthorization(status))
            }
        }
    }

    public func personalVoices() async -> [AppleSpeechVoice] {
        guard AVSpeechSynthesizer.personalVoiceAuthorizationStatus == .authorized else { return [] }
        return AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.voiceTraits.contains(.isPersonalVoice) }
            .map { AppleSpeechVoice(identifier: $0.identifier, name: $0.name, language: $0.language) }
    }

    public func speak(text: String, voiceIdentifier: String) async throws {
        guard let voice = AVSpeechSynthesisVoice(identifier: voiceIdentifier),
              voice.voiceTraits.contains(.isPersonalVoice) else {
            throw AppleVoiceBridgeError.voiceUnavailable
        }
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = voice
        synthesizer.speak(utterance)
    }
}
```

Do not use `write(_:toBufferCallback:)` in the Apple Personal Voice bridge because the ATLAS Apple provider does not expose audio-export capability.

- [ ] **Step 4: Run build/tests and commit**

Run: `swift test && swift build`

```bash
git add native/apple-personal-voice-bridge
git commit -m "feat: connect Apple Personal Voice authorization APIs"
```

---

### Task 4: Add the ATLAS-facing orchestration API

**Files:**
- Create: `native/apple-personal-voice-bridge/Sources/AtlasAppleVoiceBridge/ApplePersonalVoiceBridge.swift`
- Modify: bridge tests

**Produces:** `status()`, `requestAuthorization()`, `listVoices()`, `speak(text:voiceIdentifier:)`, `capabilities`.

- [ ] **Step 1: Write failing orchestration tests**

Test that denied authorization returns no voices, blank text is rejected, and successful speak delegates only the text and selected identifier.

- [ ] **Step 2: Run and verify failure**

Run: `swift test`

- [ ] **Step 3: Implement bridge API**

```swift
public struct ApplePersonalVoiceBridge: Sendable {
    private let system: any AppleSpeechSystem

    public init(system: any AppleSpeechSystem = SystemAppleSpeechSystem()) {
        self.system = system
    }

    public func status() async -> ApplePersonalVoiceAuthorization { /* exact status mapping */ }
    public func requestAuthorization() async -> ApplePersonalVoiceAuthorization { /* explicit user-request result */ }
    public func listVoices() async -> [ApplePersonalVoiceDescriptor] { /* authorized only */ }
    public func speak(text: String, voiceIdentifier: String) async throws { /* local playback only */ }
    public var capabilities: AppleVoiceCapabilities { .personalVoice }
}
```

Rules:
- `listVoices()` is empty unless authorized.
- `speak` rejects blank text and empty identifiers.
- `speak` returns no audio bytes; success means local playback was accepted by the system.

- [ ] **Step 4: Run tests and commit**

Run: `swift test`

```bash
git add native/apple-personal-voice-bridge
git commit -m "feat: expose governed Apple Personal Voice bridge"
```

---

### Task 5: Add native CI without affecting Node workflows

**Files:**
- Create: `.github/workflows/apple-personal-voice-bridge-ci.yml`

- [ ] **Step 1: Add workflow**

```yaml
name: Apple Personal Voice Bridge CI

on:
  pull_request:
    branches: ["main"]
    paths:
      - "native/apple-personal-voice-bridge/**"
      - ".github/workflows/apple-personal-voice-bridge-ci.yml"
  push:
    branches: ["main"]
    paths:
      - "native/apple-personal-voice-bridge/**"
      - ".github/workflows/apple-personal-voice-bridge-ci.yml"

permissions:
  contents: read

jobs:
  swift-test:
    runs-on: macos-latest
    defaults:
      run:
        working-directory: native/apple-personal-voice-bridge
    steps:
      - uses: actions/checkout@v4
      - run: swift --version
      - run: swift test
      - run: swift build
```

- [ ] **Step 2: Validate against existing workflow conventions**

Confirm indentation, `permissions: contents: read`, and no impact on Node workflow paths.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/apple-personal-voice-bridge-ci.yml
git commit -m "ci: test Apple Personal Voice native bridge"
```

---

### Task 6: Native host integration and physical-device verification gate

**Dependency:** A real ATLAS iOS/macOS host target must exist. If the repository still has no native host when this task begins, that is a real technical dependency; record bridge status as `native_bridge_built_unverified` and do not create a fake web shim or guessed host path.

**Consumes:** `ApplePersonalVoiceBridge`.

- [ ] **Step 1: Add the local Swift package to the real native ATLAS target**

The host imports:

```swift
import AtlasAppleVoiceBridge
```

- [ ] **Step 2: Render authorization state without auto-prompting**

On view load call `status()`. Call `requestAuthorization()` only after explicit user action such as `Allow ATLAS to Use Personal Voice`.

- [ ] **Step 3: Enumerate authorized voices**

After authorization, call `listVoices()`. If empty, show `No authorized Personal Voice is currently available on this device`.

- [ ] **Step 4: Test local playback**

```swift
try await bridge.speak(text: testPhrase, voiceIdentifier: selectedVoice.identifier)
```

Expected: speech is heard locally from the selected Personal Voice.

- [ ] **Step 5: Verify capability reporting**

The host must report:
- local playback: available
- audio export: unavailable
- realtime stream: unavailable
- telephony: unavailable
- server synthesis: unavailable

- [ ] **Step 6: Physical-device verification**

On a supported device with a real Personal Voice:
1. Verify current authorization state.
2. Tap request and verify Apple's authorization UI.
3. Test denied state; ATLAS remains usable.
4. Authorize and verify a Personal Voice appears.
5. Play a test phrase locally.
6. Change permission in Settings, return, and verify refreshed state.
7. Confirm no audio file, upload, or server model is produced.

- [ ] **Step 7: Production truth-state gate**

Before device verification, keep `native_bridge_built_unverified`. Only after all checks pass may the tested platform/OS combination be recorded as `verified_on_supported_device`.

- [ ] **Step 8: Commit only actual native-host files discovered at execution time**

Use the real file paths from the native ATLAS target and commit with:

```bash
git commit -m "feat: integrate Apple Personal Voice into ATLAS native client"
```

No guessed paths are permitted.

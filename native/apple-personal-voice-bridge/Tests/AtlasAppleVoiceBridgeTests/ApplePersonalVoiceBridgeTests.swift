import XCTest
@testable import AtlasAppleVoiceBridge

actor FakeAppleSpeechSystem: AppleSpeechSystem {
    var authorization: AppleSpeechAuthorizationState
    var voices: [AppleSpeechVoice]
    private(set) var spoken: [(String, String)] = []

    init(
        authorization: AppleSpeechAuthorizationState = .notDetermined,
        voices: [AppleSpeechVoice] = []
    ) {
        self.authorization = authorization
        self.voices = voices
    }

    func authorizationStatus() async -> AppleSpeechAuthorizationState { authorization }
    func requestAuthorization() async -> AppleSpeechAuthorizationState { authorization }
    func personalVoices() async -> [AppleSpeechVoice] { voices }
    func speak(text: String, voiceIdentifier: String) async throws {
        spoken.append((text, voiceIdentifier))
    }
    func spokenValues() -> [(String,String)] { spoken }
}

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

    @available(iOS 17.0, macOS 14.0, *)
    func testDeniedAuthorizationReturnsNoVoices() async {
        let system = FakeAppleSpeechSystem(authorization: .denied)
        let bridge = ApplePersonalVoiceBridge(system: system)
        let status = await bridge.status()
        let voices = await bridge.listVoices()
        XCTAssertEqual(status, .denied)
        XCTAssertEqual(voices, [])
    }

    @available(iOS 17.0, macOS 14.0, *)
    func testAuthorizedPersonalVoiceCanBeSelectedForLocalSpeech() async throws {
        let voice = AppleSpeechVoice(identifier: "personal-1", name: "Personal", language: "es-MX")
        let system = FakeAppleSpeechSystem(authorization: .authorized, voices: [voice])
        let bridge = ApplePersonalVoiceBridge(system: system)
        try await bridge.speak(text: "Hola ATLAS", voiceIdentifier: voice.identifier)
        let spoken = await system.spokenValues()
        XCTAssertEqual(spoken.count, 1)
        XCTAssertEqual(spoken[0].0, "Hola ATLAS")
        XCTAssertEqual(spoken[0].1, "personal-1")
    }

    @available(iOS 17.0, macOS 14.0, *)
    func testBlankTextIsRejected() async {
        let system = FakeAppleSpeechSystem(authorization: .authorized)
        let bridge = ApplePersonalVoiceBridge(system: system)
        do {
            try await bridge.speak(text: "  ", voiceIdentifier: "personal-1")
            XCTFail("Expected invalidText")
        } catch {
            XCTAssertEqual(error as? AppleVoiceBridgeError, .invalidText)
        }
    }

    @available(iOS 17.0, macOS 14.0, *)
    func testInspectionNeverMarksPlaybackVerifiedAutomatically() async {
        let voice = AppleSpeechVoice(identifier: "personal-1", name: "Personal", language: "es-MX")
        let system = FakeAppleSpeechSystem(authorization: .authorized, voices: [voice])
        let verifier = ApplePersonalVoiceVerifier(bridge: ApplePersonalVoiceBridge(system: system))
        let report = await verifier.inspect(platform: "ios", osVersion: "26.6")
        XCTAssertEqual(report.authorization, .authorized)
        XCTAssertEqual(report.personalVoiceCount, 1)
        XCTAssertFalse(report.localPlaybackVerified)
        XCTAssertEqual(report.capabilities, .personalVoice)
    }
}

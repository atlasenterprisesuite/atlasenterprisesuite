import XCTest
@testable import AtlasAppleVoiceBridge

actor FakeAppleSpeechSystem: AppleSpeechSystem {
    var authorization: AppleSpeechAuthorizationState
    var voices: [AppleSpeechVoice]
    var spoken: [(String, String)] = []

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

    func spokenCalls() -> [(String, String)] { spoken }
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

    func testAllAuthorizationStatesMapExactly() async {
        let cases: [(AppleSpeechAuthorizationState, ApplePersonalVoiceAuthorization)] = [
            (.authorized, .authorized),
            (.denied, .denied),
            (.notDetermined, .notDetermined),
            (.unsupported, .unsupported)
        ]

        for (systemState, expected) in cases {
            let bridge = ApplePersonalVoiceBridge(system: FakeAppleSpeechSystem(authorization: systemState))
            let status = await bridge.status()
            XCTAssertEqual(status, expected)
        }
    }

    func testDeniedAuthorizationReturnsNoVoices() async {
        let fake = FakeAppleSpeechSystem(
            authorization: .denied,
            voices: [AppleSpeechVoice(identifier: "voice-1", name: "Personal", language: "en-US")]
        )
        let bridge = ApplePersonalVoiceBridge(system: fake)
        let status = await bridge.status()
        let voices = await bridge.listVoices()
        XCTAssertEqual(status, .denied)
        XCTAssertTrue(voices.isEmpty)
    }

    func testAuthorizedListMapsDescriptors() async {
        let fake = FakeAppleSpeechSystem(
            authorization: .authorized,
            voices: [AppleSpeechVoice(identifier: "voice-1", name: "Personal", language: "en-US")]
        )
        let bridge = ApplePersonalVoiceBridge(system: fake)
        let voices = await bridge.listVoices()
        XCTAssertEqual(
            voices,
            [ApplePersonalVoiceDescriptor(identifier: "voice-1", name: "Personal", language: "en-US")]
        )
    }

    func testSpeakRejectsBlankText() async {
        let fake = FakeAppleSpeechSystem(authorization: .authorized)
        let bridge = ApplePersonalVoiceBridge(system: fake)
        do {
            try await bridge.speak(text: "   ", voiceIdentifier: "voice-1")
            XCTFail("Expected blank text to be rejected")
        } catch {
            XCTAssertEqual(error as? AppleVoiceBridgeError, .invalidText)
        }
    }

    func testSpeakRejectsBlankIdentifier() async {
        let fake = FakeAppleSpeechSystem(authorization: .authorized)
        let bridge = ApplePersonalVoiceBridge(system: fake)
        do {
            try await bridge.speak(text: "Hello", voiceIdentifier: " ")
            XCTFail("Expected blank identifier to be rejected")
        } catch {
            XCTAssertEqual(error as? AppleVoiceBridgeError, .invalidVoiceIdentifier)
        }
    }

    func testSpeakRequiresAuthorization() async {
        let fake = FakeAppleSpeechSystem(authorization: .denied)
        let bridge = ApplePersonalVoiceBridge(system: fake)
        do {
            try await bridge.speak(text: "Hello", voiceIdentifier: "voice-1")
            XCTFail("Expected authorization to be required")
        } catch {
            XCTAssertEqual(error as? AppleVoiceBridgeError, .notAuthorized)
        }
    }

    func testSuccessfulSpeakDelegatesTextAndIdentifierOnly() async throws {
        let fake = FakeAppleSpeechSystem(authorization: .authorized)
        let bridge = ApplePersonalVoiceBridge(system: fake)
        try await bridge.speak(text: "Hello ATLAS", voiceIdentifier: "voice-1")
        let calls = await fake.spokenCalls()
        XCTAssertEqual(calls.count, 1)
        XCTAssertEqual(calls.first?.0, "Hello ATLAS")
        XCTAssertEqual(calls.first?.1, "voice-1")
    }
}

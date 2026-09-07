#if canImport(AVFAudio)
import AVFAudio

public actor SystemAppleSpeechSystem: AppleSpeechSystem {
    private let synthesizer = AVSpeechSynthesizer()

    public init() {}

    public func authorizationStatus() async -> AppleSpeechAuthorizationState {
        Self.mapAuthorization(AVSpeechSynthesizer.personalVoiceAuthorizationStatus)
    }

    public func requestAuthorization() async -> AppleSpeechAuthorizationState {
        await withCheckedContinuation { continuation in
            AVSpeechSynthesizer.requestPersonalVoiceAuthorization { status in
                continuation.resume(returning: Self.mapAuthorization(status))
            }
        }
    }

    public func personalVoices() async -> [AppleSpeechVoice] {
        guard AVSpeechSynthesizer.personalVoiceAuthorizationStatus == .authorized else { return [] }
        return AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.voiceTraits.contains(.isPersonalVoice) }
            .map {
                AppleSpeechVoice(
                    identifier: $0.identifier,
                    name: $0.name,
                    language: $0.language
                )
            }
    }

    public func speak(text: String, voiceIdentifier: String) async throws {
        guard AVSpeechSynthesizer.personalVoiceAuthorizationStatus == .authorized else {
            throw AppleVoiceBridgeError.notAuthorized
        }
        guard let voice = AVSpeechSynthesisVoice(identifier: voiceIdentifier),
              voice.voiceTraits.contains(.isPersonalVoice) else {
            throw AppleVoiceBridgeError.voiceUnavailable
        }
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = voice
        synthesizer.speak(utterance)
    }

    private static func mapAuthorization(
        _ status: AVSpeechSynthesizer.PersonalVoiceAuthorizationStatus
    ) -> AppleSpeechAuthorizationState {
        switch status {
        case .authorized: return .authorized
        case .denied: return .denied
        case .notDetermined: return .notDetermined
        case .unsupported: return .unsupported
        @unknown default: return .unsupported
        }
    }
}
#else
public actor SystemAppleSpeechSystem: AppleSpeechSystem {
    public init() {}

    public func authorizationStatus() async -> AppleSpeechAuthorizationState { .unsupported }
    public func requestAuthorization() async -> AppleSpeechAuthorizationState { .unsupported }
    public func personalVoices() async -> [AppleSpeechVoice] { [] }
    public func speak(text: String, voiceIdentifier: String) async throws {
        throw AppleVoiceBridgeError.unsupportedPlatform
    }
}
#endif

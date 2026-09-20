import AVFAudio
import Foundation

@available(iOS 17.0, macOS 14.0, *)
public actor SystemAppleSpeechSystem: AppleSpeechSystem {
    private let synthesizer = AVSpeechSynthesizer()

    public init() {}

    public func authorizationStatus() async -> AppleSpeechAuthorizationState {
        switch AVSpeechSynthesizer.personalVoiceAuthorizationStatus {
        case .authorized:
            return .authorized
        case .denied:
            return .denied
        case .notDetermined:
            return .notDetermined
        @unknown default:
            return .unsupported
        }
    }

    public func requestAuthorization() async -> AppleSpeechAuthorizationState {
        await withCheckedContinuation { continuation in
            AVSpeechSynthesizer.requestPersonalVoiceAuthorization { status in
                switch status {
                case .authorized:
                    continuation.resume(returning: .authorized)
                case .denied:
                    continuation.resume(returning: .denied)
                case .notDetermined:
                    continuation.resume(returning: .notDetermined)
                @unknown default:
                    continuation.resume(returning: .unsupported)
                }
            }
        }
    }

    public func personalVoices() async -> [AppleSpeechVoice] {
        guard AVSpeechSynthesizer.personalVoiceAuthorizationStatus == .authorized else {
            return []
        }
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
        guard let voice = AVSpeechSynthesisVoice(identifier: voiceIdentifier),
              voice.voiceTraits.contains(.isPersonalVoice) else {
            throw AppleVoiceBridgeError.voiceUnavailable
        }
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = voice
        synthesizer.speak(utterance)
    }
}

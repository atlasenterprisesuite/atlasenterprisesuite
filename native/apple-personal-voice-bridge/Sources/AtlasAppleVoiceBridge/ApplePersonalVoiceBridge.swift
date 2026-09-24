import Foundation

@available(iOS 17.0, macOS 14.0, *)
public struct ApplePersonalVoiceBridge: Sendable {
    private let system: any AppleSpeechSystem

    public init(system: any AppleSpeechSystem = SystemAppleSpeechSystem()) {
        self.system = system
    }

    public var capabilities: AppleVoiceCapabilities { .personalVoice }

    public func status() async -> ApplePersonalVoiceAuthorization {
        map(await system.authorizationStatus())
    }

    public func requestAuthorization() async -> ApplePersonalVoiceAuthorization {
        map(await system.requestAuthorization())
    }

    public func listVoices() async -> [ApplePersonalVoiceDescriptor] {
        guard await system.authorizationStatus() == .authorized else { return [] }
        return await system.personalVoices().map {
            ApplePersonalVoiceDescriptor(identifier: $0.identifier, name: $0.name, language: $0.language)
        }
    }

    public func speak(text: String, voiceIdentifier: String) async throws {
        let cleanText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanIdentifier = voiceIdentifier.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanText.isEmpty else { throw AppleVoiceBridgeError.invalidText }
        guard !cleanIdentifier.isEmpty else { throw AppleVoiceBridgeError.invalidVoiceIdentifier }
        guard await system.authorizationStatus() == .authorized else {
            throw AppleVoiceBridgeError.authorizationRequired
        }
        let identifiers = Set(await system.personalVoices().map(\.identifier))
        guard identifiers.contains(cleanIdentifier) else {
            throw AppleVoiceBridgeError.voiceUnavailable
        }
        try await system.speak(text: cleanText, voiceIdentifier: cleanIdentifier)
    }

    private func map(_ value: AppleSpeechAuthorizationState) -> ApplePersonalVoiceAuthorization {
        switch value {
        case .authorized: return .authorized
        case .denied: return .denied
        case .notDetermined: return .notDetermined
        case .unsupported: return .unsupported
        }
    }
}

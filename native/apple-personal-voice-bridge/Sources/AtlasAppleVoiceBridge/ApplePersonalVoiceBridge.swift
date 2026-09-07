import Foundation

public struct ApplePersonalVoiceBridge: Sendable {
    private let system: any AppleSpeechSystem

    public init(system: (any AppleSpeechSystem)? = nil) {
        self.system = system ?? SystemAppleSpeechSystem()
    }

    public var capabilities: AppleVoiceCapabilities { .personalVoice }

    public func status() async -> ApplePersonalVoiceAuthorization {
        mapAuthorization(await system.authorizationStatus())
    }

    public func requestAuthorization() async -> ApplePersonalVoiceAuthorization {
        mapAuthorization(await system.requestAuthorization())
    }

    public func listVoices() async -> [ApplePersonalVoiceDescriptor] {
        guard await system.authorizationStatus() == .authorized else { return [] }
        return await system.personalVoices().map {
            ApplePersonalVoiceDescriptor(
                identifier: $0.identifier,
                name: $0.name,
                language: $0.language
            )
        }
    }

    public func speak(text: String, voiceIdentifier: String) async throws {
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedIdentifier = voiceIdentifier.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else { throw AppleVoiceBridgeError.invalidText }
        guard !trimmedIdentifier.isEmpty else { throw AppleVoiceBridgeError.invalidVoiceIdentifier }
        guard await system.authorizationStatus() == .authorized else {
            throw AppleVoiceBridgeError.notAuthorized
        }
        try await system.speak(text: text, voiceIdentifier: voiceIdentifier)
    }

    private func mapAuthorization(_ status: AppleSpeechAuthorizationState) -> ApplePersonalVoiceAuthorization {
        switch status {
        case .authorized: return .authorized
        case .denied: return .denied
        case .notDetermined: return .notDetermined
        case .unsupported: return .unsupported
        }
    }
}

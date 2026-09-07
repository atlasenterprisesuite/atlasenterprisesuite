public enum AppleSpeechAuthorizationState: Equatable, Sendable {
    case authorized
    case denied
    case notDetermined
    case unsupported
}

public struct AppleSpeechVoice: Equatable, Sendable {
    public let identifier: String
    public let name: String
    public let language: String

    public init(identifier: String, name: String, language: String) {
        self.identifier = identifier
        self.name = name
        self.language = language
    }
}

public protocol AppleSpeechSystem: Sendable {
    func authorizationStatus() async -> AppleSpeechAuthorizationState
    func requestAuthorization() async -> AppleSpeechAuthorizationState
    func personalVoices() async -> [AppleSpeechVoice]
    func speak(text: String, voiceIdentifier: String) async throws
}

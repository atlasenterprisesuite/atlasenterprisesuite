public enum ApplePersonalVoiceAuthorization: String, Codable, Sendable {
    case authorized
    case denied
    case notDetermined
    case unsupported
}

public struct ApplePersonalVoiceDescriptor: Codable, Equatable, Sendable {
    public let identifier: String
    public let name: String
    public let language: String

    public init(identifier: String, name: String, language: String) {
        self.identifier = identifier
        self.name = name
        self.language = language
    }
}

public struct AppleVoiceCapabilities: Codable, Equatable, Sendable {
    public let localPlayback: Bool
    public let audioExport: Bool
    public let realtimeStream: Bool
    public let telephony: Bool
    public let serverSynthesis: Bool

    public init(
        localPlayback: Bool,
        audioExport: Bool,
        realtimeStream: Bool,
        telephony: Bool,
        serverSynthesis: Bool
    ) {
        self.localPlayback = localPlayback
        self.audioExport = audioExport
        self.realtimeStream = realtimeStream
        self.telephony = telephony
        self.serverSynthesis = serverSynthesis
    }

    public static let personalVoice = AppleVoiceCapabilities(
        localPlayback: true,
        audioExport: false,
        realtimeStream: false,
        telephony: false,
        serverSynthesis: false
    )
}

public enum AppleVoiceBridgeError: Error, Equatable, Sendable {
    case invalidText
    case invalidVoiceIdentifier
    case notAuthorized
    case voiceUnavailable
    case unsupportedPlatform
}

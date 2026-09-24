import Foundation

public struct ApplePersonalVoiceVerificationReport: Codable, Equatable, Sendable {
    public let platform: String
    public let osVersion: String
    public let authorization: ApplePersonalVoiceAuthorization
    public let personalVoiceCount: Int
    public let localPlaybackVerified: Bool
    public let capabilities: AppleVoiceCapabilities
    public let generatedAt: Date

    public init(
        platform: String,
        osVersion: String,
        authorization: ApplePersonalVoiceAuthorization,
        personalVoiceCount: Int,
        localPlaybackVerified: Bool,
        capabilities: AppleVoiceCapabilities,
        generatedAt: Date = Date()
    ) {
        self.platform = platform
        self.osVersion = osVersion
        self.authorization = authorization
        self.personalVoiceCount = personalVoiceCount
        self.localPlaybackVerified = localPlaybackVerified
        self.capabilities = capabilities
        self.generatedAt = generatedAt
    }
}

@available(iOS 17.0, macOS 14.0, *)
public struct ApplePersonalVoiceVerifier: Sendable {
    private let bridge: ApplePersonalVoiceBridge

    public init(bridge: ApplePersonalVoiceBridge = ApplePersonalVoiceBridge()) {
        self.bridge = bridge
    }

    public func inspect(platform: String, osVersion: String) async -> ApplePersonalVoiceVerificationReport {
        let authorization = await bridge.status()
        let voices = authorization == .authorized ? await bridge.listVoices() : []
        return ApplePersonalVoiceVerificationReport(
            platform: platform,
            osVersion: osVersion,
            authorization: authorization,
            personalVoiceCount: voices.count,
            localPlaybackVerified: false,
            capabilities: bridge.capabilities
        )
    }

    public func reportAfterUserConfirmedPlayback(
        platform: String,
        osVersion: String
    ) async -> ApplePersonalVoiceVerificationReport {
        let authorization = await bridge.status()
        let voices = authorization == .authorized ? await bridge.listVoices() : []
        return ApplePersonalVoiceVerificationReport(
            platform: platform,
            osVersion: osVersion,
            authorization: authorization,
            personalVoiceCount: voices.count,
            localPlaybackVerified: authorization == .authorized && !voices.isEmpty,
            capabilities: bridge.capabilities
        )
    }
}

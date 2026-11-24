import Foundation

public enum ScreenSessionError: Error, Equatable {
    case consentRequired, unauthorized, expired, invalidFrame, replayedFrame
}
public struct ScreenSession: Sendable {
    public let tenantID: String
    public let userID: String
    public let sessionID: UUID
    public let expiresAt: Date
    public private(set) var active: Bool
    public private(set) var lastSequence: UInt64

    public init(tenantID: String, userID: String, sessionID: UUID = UUID(), expiresAt: Date, consentGranted: Bool) throws {
        guard consentGranted else { throw ScreenSessionError.consentRequired }
        guard !tenantID.isEmpty && !userID.isEmpty else { throw ScreenSessionError.unauthorized }
        self.tenantID = tenantID
        self.userID = userID
        self.sessionID = sessionID
        self.expiresAt = expiresAt
        self.active = true
        self.lastSequence = 0
    }

    public mutating func authorizeFrame(tenantID: String, userID: String, now: Date, sequence: UInt64, byteCount: Int) throws {
        guard active && now < expiresAt else { throw ScreenSessionError.expired }
        guard tenantID == self.tenantID && userID == self.userID else { throw ScreenSessionError.unauthorized }
        guard sequence > lastSequence else { throw ScreenSessionError.replayedFrame }
        guard byteCount > 0 && byteCount <= 2_000_000 else { throw ScreenSessionError.invalidFrame }
        lastSequence = sequence
    }

    public mutating func revoke() { active = false }
}

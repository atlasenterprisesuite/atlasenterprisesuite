import Foundation
import XCTest
@testable import AtlasLiveScreenBridge

final class ScreenSessionPolicyTests: XCTestCase {
    func testConsentIsMandatory() {
        XCTAssertThrowsError(try ScreenSession(tenantID: "a", userID: "u", expiresAt: Date().addingTimeInterval(60), consentGranted: false))
    }
    func testTenantIsolationAndReplayProtection() throws {
        let now = Date()
        var session = try ScreenSession(tenantID: "a", userID: "u", expiresAt: now.addingTimeInterval(60), consentGranted: true)
        XCTAssertThrowsError(try session.authorizeFrame(tenantID: "b", userID: "u", now: now, sequence: 1, byteCount: 10))
        try session.authorizeFrame(tenantID: "a", userID: "u", now: now, sequence: 1, byteCount: 10)
        XCTAssertThrowsError(try session.authorizeFrame(tenantID: "a", userID: "u", now: now, sequence: 1, byteCount: 10))
    }
    func testRevocationAndExpirationFailClosed() throws {
        let now = Date()
        var session = try ScreenSession(tenantID: "a", userID: "u", expiresAt: now.addingTimeInterval(60), consentGranted: true)
        session.revoke()
        XCTAssertThrowsError(try session.authorizeFrame(tenantID: "a", userID: "u", now: now, sequence: 1, byteCount: 10))
        var expired = try ScreenSession(tenantID: "a", userID: "u", expiresAt: now, consentGranted: true)
        XCTAssertThrowsError(try expired.authorizeFrame(tenantID: "a", userID: "u", now: now, sequence: 1, byteCount: 10))
    }
    func testOversizedFrameRejected() throws {
        let now = Date()
        var session = try ScreenSession(tenantID: "a", userID: "u", expiresAt: now.addingTimeInterval(60), consentGranted: true)
        XCTAssertThrowsError(try session.authorizeFrame(tenantID: "a", userID: "u", now: now, sequence: 1, byteCount: 2_000_001))
    }
}

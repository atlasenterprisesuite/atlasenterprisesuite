import CoreLocation
import XCTest
@testable import AtlasAppleNavigationBridge

final class AtlasAppleNavigationBridgeTests: XCTestCase {
    func testLocationMapsToNavigationSample() throws {
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let location = CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: 28.378004, longitude: -81.4931874),
            altitude: 31,
            horizontalAccuracy: 4.5,
            verticalAccuracy: 8,
            course: 91,
            speed: 12.4,
            timestamp: date
        )

        let sample = AtlasNavigationSample.from(location)

        XCTAssertEqual(sample.event, "location")
        XCTAssertEqual(sample.latitude, 28.378004, accuracy: 0.000001)
        XCTAssertEqual(sample.longitude, -81.4931874, accuracy: 0.000001)
        XCTAssertEqual(sample.horizontalAccuracyM, 4.5)
        XCTAssertEqual(sample.courseDeg, 91)
        XCTAssertEqual(sample.speedMps, 12.4)
        XCTAssertEqual(sample.timestampMs, date.timeIntervalSince1970 * 1000, accuracy: 0.01)
    }

    func testInvalidAppleMeasurementsBecomeNil() {
        let location = CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: 28.0, longitude: -81.0),
            altitude: 0,
            horizontalAccuracy: -1,
            verticalAccuracy: -1,
            course: -1,
            speed: -1,
            timestamp: Date(timeIntervalSince1970: 10)
        )

        let sample = AtlasNavigationSample.from(location)

        XCTAssertNil(sample.horizontalAccuracyM)
        XCTAssertNil(sample.courseDeg)
        XCTAssertNil(sample.speedMps)
    }

    func testJsonKeysMatchWebBridgeContract() throws {
        let sample = AtlasNavigationSample(
            latitude: 28.5,
            longitude: -81.4,
            horizontalAccuracyM: 3,
            courseDeg: 180,
            speedMps: 10,
            timestampMs: 1234
        )

        let object = try sample.jsonObject()

        XCTAssertEqual(object["event"] as? String, "location")
        XCTAssertEqual(object["horizontal_accuracy_m"] as? Double, 3)
        XCTAssertEqual(object["course_deg"] as? Double, 180)
        XCTAssertEqual(object["speed_mps"] as? Double, 10)
        XCTAssertEqual(object["timestamp_ms"] as? Double, 1234)
    }
}

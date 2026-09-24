import CoreLocation
import Foundation

public struct AtlasNavigationSample: Codable, Equatable, Sendable {
    public let event: String
    public let latitude: Double
    public let longitude: Double
    public let horizontalAccuracyM: Double?
    public let courseDeg: Double?
    public let speedMps: Double?
    public let timestampMs: Double

    enum CodingKeys: String, CodingKey {
        case event
        case latitude
        case longitude
        case horizontalAccuracyM = "horizontal_accuracy_m"
        case courseDeg = "course_deg"
        case speedMps = "speed_mps"
        case timestampMs = "timestamp_ms"
    }

    public init(
        latitude: Double,
        longitude: Double,
        horizontalAccuracyM: Double?,
        courseDeg: Double?,
        speedMps: Double?,
        timestampMs: Double
    ) {
        self.event = "location"
        self.latitude = latitude
        self.longitude = longitude
        self.horizontalAccuracyM = horizontalAccuracyM
        self.courseDeg = courseDeg
        self.speedMps = speedMps
        self.timestampMs = timestampMs
    }

    public static func from(_ location: CLLocation) -> AtlasNavigationSample {
        AtlasNavigationSample(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            horizontalAccuracyM: location.horizontalAccuracy >= 0 ? location.horizontalAccuracy : nil,
            courseDeg: location.course >= 0 ? location.course : nil,
            speedMps: location.speed >= 0 ? location.speed : nil,
            timestampMs: location.timestamp.timeIntervalSince1970 * 1000
        )
    }

    public func jsonObject() throws -> [String: Any] {
        let data = try JSONEncoder().encode(self)
        let object = try JSONSerialization.jsonObject(with: data)
        guard let dictionary = object as? [String: Any] else {
            throw AtlasNavigationBridgeError.invalidPayload
        }
        return dictionary
    }
}

public enum AtlasNavigationBridgeError: Error {
    case invalidPayload
}

@MainActor
public final class AtlasAppleNavigationLocationProvider: NSObject, CLLocationManagerDelegate {
    public typealias SampleHandler = @Sendable (AtlasNavigationSample) -> Void
    public typealias ErrorHandler = @Sendable (String) -> Void

    private let manager: CLLocationManager
    private var sampleHandler: SampleHandler?
    private var errorHandler: ErrorHandler?

    public init(manager: CLLocationManager = CLLocationManager()) {
        self.manager = manager
        super.init()
        self.manager.delegate = self
        self.manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        self.manager.distanceFilter = kCLDistanceFilterNone
        self.manager.activityType = .automotiveNavigation
        #if os(iOS)
        self.manager.pausesLocationUpdatesAutomatically = false
        #endif
    }

    public func start(
        onSample: @escaping SampleHandler,
        onError: @escaping ErrorHandler
    ) {
        sampleHandler = onSample
        errorHandler = onError
        manager.requestWhenInUseAuthorization()
        manager.startUpdatingLocation()
    }

    public func stop() {
        manager.stopUpdatingLocation()
        sampleHandler = nil
        errorHandler = nil
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let latest = locations.last else { return }
        sampleHandler?(.from(latest))
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        errorHandler?(String(describing: error))
    }
}

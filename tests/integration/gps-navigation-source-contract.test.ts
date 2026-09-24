import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('apps/web/src/modules/gps/Gps4DPage.tsx', 'utf8');
const engine = readFileSync('apps/web/src/modules/gps/navigationEngine.ts', 'utf8');
const source = readFileSync('apps/web/src/modules/gps/navigationLocation.ts', 'utf8');
const swift = readFileSync('native/apple-navigation-bridge/Sources/AtlasAppleNavigationBridge/AtlasAppleNavigationBridge.swift', 'utf8');
const packageSwift = readFileSync('native/apple-navigation-bridge/Package.swift', 'utf8');

describe('ATLAS navigation source contract', () => {
  it('decouples location input from React presentation state', () => {
    expect(page).toContain('createNavigationLocationSource');
    expect(page).toContain('AtlasNavigationEngine');
    expect(page).not.toContain('navigator.geolocation.watchPosition');
    expect(source).toContain("kind: 'browser-geolocation'");
    expect(source).toContain("kind: 'apple-native-bridge'");
  });

  it('uses route-relative map matching and confirmed rerouting', () => {
    expect(engine).toContain('projectToRoute');
    expect(engine).toContain("source: maySnap ? 'route-snap' : 'gps'");
    expect(engine).toContain('rerouteConfirmationsRequired');
    expect(page).toContain('observation.reroute_suggested');
  });

  it('keeps the Apple bridge native and Core Location based', () => {
    expect(packageSwift).toContain('AtlasAppleNavigationBridge');
    expect(swift).toContain('import CoreLocation');
    expect(swift).toContain('kCLLocationAccuracyBestForNavigation');
    expect(swift).toContain('.automotiveNavigation');
    expect(swift).toContain('location.course');
    expect(swift).toContain('location.speed');
  });

  it('does not claim proprietary Google or Apple navigation SDK integration', () => {
    expect(page).not.toContain('google.maps');
    expect(page).not.toContain('GMSNavigation');
    expect(page).not.toContain('MKDirections');
    expect(source).not.toContain('maps.googleapis.com');
  });
});

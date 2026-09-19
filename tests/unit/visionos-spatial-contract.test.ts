import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = 'apps/visionos/AtlasSpatial';
const app = readFileSync(`${root}/Sources/AtlasSpatialApp.swift`, 'utf8');
const bridge = readFileSync(`${root}/Sources/PortalBridgeHandler.swift`, 'utf8');
const web = readFileSync(`${root}/Sources/PortalWebView.swift`, 'utf8');
const immersive = readFileSync(`${root}/Sources/AtlasPortalImmersiveView.swift`, 'utf8');
const tracking = readFileSync(`${root}/Sources/PortalTraversalMonitor.swift`, 'utf8');
const policy = readFileSync(`${root}/Sources/PortalDestination.swift`, 'utf8');
const project = readFileSync(`${root}/project.yml`, 'utf8');
const readiness = JSON.parse(readFileSync('data/ops/visionos-spatial-readiness.json', 'utf8'));

describe('ATLAS visionOS spatial app contract', () => {
  it('defines a native SwiftUI immersive-space application', () => {
    expect(app).toContain('WindowGroup');
    expect(app).toContain('ImmersiveSpace');
    expect(app).toContain('AtlasPortalImmersiveView');
    expect(immersive).toContain('RealityView');
    expect(immersive).toContain('SpatialTapGesture');
  });

  it('binds the existing web bridge to native WebKit without treating it as auth', () => {
    expect(bridge).toContain('WKScriptMessageHandler');
    expect(bridge).toContain('atlasSpatialPortals');
    expect(web).toContain('https://www.atlasenterprisesuite.com/galaxy/portals');
    expect(policy).toContain('atlas.portal.open');
    expect(policy).toContain('allowedRoutes');
  });

  it('uses real visionOS world tracking for walk-through detection', () => {
    expect(tracking).toContain('WorldTrackingProvider');
    expect(tracking).toContain('queryDeviceAnchor');
    expect(tracking).toContain('CACurrentMediaTime');
    expect(tracking).not.toContain('mock');
  });

  it('keeps Apple signing material out of the project contract', () => {
    expect(project).toContain('CODE_SIGN_STYLE: Automatic');
    expect(project).toContain('DEVELOPMENT_TEAM: ""');
    const source = [app, bridge, web, immersive, tracking, policy, project].join('\n');
    for (const forbidden of [
      'BEGIN PRIVATE KEY',
      'BEGIN CERTIFICATE',
      '.p12',
      'PROVISIONING_PROFILE_SPECIFIER:'
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('fails closed on live readiness until signed physical-device evidence exists', () => {
    expect(readiness.source_state).toBe('source-ready');
    expect(readiness.simulator_state).toBe('verification-required');
    expect(readiness.signed_build_state).toBe('verification-required');
    expect(readiness.physical_device_state).toBe('verification-required');
    expect(readiness.live).toBe(false);
  });
});

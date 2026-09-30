export type AtlasDeviceId =
  | 'phone'
  | 'fold'
  | 'tablet'
  | 'watch'
  | 'glasses'
  | 'ring'
  | 'buds'
  | 'laptop'
  | 'home'
  | 'car';

export type AtlasDeviceCapability = {
  id: string;
  label: string;
  status: 'implemented-core' | 'adapter-required';
};

export type AtlasDeviceProfile = {
  id: AtlasDeviceId;
  name: string;
  category: string;
  description: string;
  capabilities: readonly AtlasDeviceCapability[];
};

const sharedSoftware = [
  { id: 'identity', label: 'ATLAS Identity', status: 'implemented-core' },
  { id: 'connect', label: 'ATLAS Connect', status: 'implemented-core' },
  { id: 'privacy', label: 'Privacy Center', status: 'implemented-core' },
  { id: 'automation', label: 'Automation Engine', status: 'implemented-core' }
] as const satisfies readonly AtlasDeviceCapability[];

function profile(
  id: AtlasDeviceId,
  name: string,
  category: string,
  description: string,
  hardware: readonly string[]
): AtlasDeviceProfile {
  return {
    id,
    name,
    category,
    description,
    capabilities: [
      ...sharedSoftware,
      ...hardware.map((label) => ({
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label,
        status: 'adapter-required' as const
      }))
    ]
  };
}

export const ATLAS_DEVICE_PROFILES: readonly AtlasDeviceProfile[] = [
  profile('phone', 'ATLAS Phone Pro', 'Mobile', 'Primary mobile ATLAS surface for communication, camera, wallet, health and navigation.', ['Camera bridge', 'Cellular radio', 'Secure element']),
  profile('fold', 'ATLAS Fold', 'Adaptive Mobile', 'Phone, book, tablet and desk layouts on one continuity session.', ['Fold posture sensor', 'Multi-display bridge']),
  profile('tablet', 'ATLAS Tablet Max', 'Creation', 'Pen-first creation, external display and desktop-class ATLAS workflows.', ['Stylus bridge', 'External display bridge']),
  profile('watch', 'ATLAS Watch X', 'Wearable', 'Identity, health, navigation and emergency actions on the wrist.', ['Health sensors', 'Haptics', 'eSIM bridge']),
  profile('glasses', 'ATLAS Glasses', 'Spatial', 'Context HUD, translation, navigation and visual assistance.', ['Spatial camera', 'Waveguide display', 'Microphone array']),
  profile('ring', 'ATLAS Ring', 'Ambient', 'Presence, identity, recovery signals and discreet gesture control.', ['Biometric sensors', 'NFC secure element']),
  profile('buds', 'ATLAS Buds Pro', 'Audio', 'Adaptive audio, translation, ATLAS Voice and device handoff.', ['Audio DSP', 'Microphone array']),
  profile('laptop', 'ATLAS Laptop Ultra', 'Desktop', 'Desktop shell, workspaces, files, diagnostics and continuity.', ['Firmware bridge', 'Battery telemetry']),
  profile('home', 'ATLAS Home Hub', 'Smart Space', 'Local smart-space control for rooms, cameras, energy and automations.', ['Matter/Thread radio', 'Camera bridge']),
  profile('car', 'ATLAS Car Unit', 'Mobility', 'Navigation, diagnostics, maintenance, media and emergency coordination.', ['Vehicle bus adapter', 'GNSS', 'Telematics modem'])
];

export function getAtlasDeviceProfile(id: AtlasDeviceId): AtlasDeviceProfile {
  const profile = ATLAS_DEVICE_PROFILES.find((entry) => entry.id === id);
  if (!profile) throw new Error(`Unknown ATLAS device profile: ${id}`);
  return profile;
}

export function summarizeDeviceReadiness(profile: AtlasDeviceProfile) {
  const implementedCore = profile.capabilities.filter((capability) => capability.status === 'implemented-core').length;
  const adapterRequired = profile.capabilities.length - implementedCore;
  return { implementedCore, adapterRequired, total: profile.capabilities.length };
}

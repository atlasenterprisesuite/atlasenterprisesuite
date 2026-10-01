export type AtlasHardwareConceptStatus =
  | 'software-surface'
  | 'prototype-required'
  | 'research-track';

export type AtlasHardwareConcept = {
  id: string;
  name: string;
  category: string;
  purpose: string;
  status: AtlasHardwareConceptStatus;
  dependency: string;
};

export const ATLAS_BOOT_PIPELINE = [
  'Power',
  'Device DNA',
  'Hardware check',
  'Security check',
  'Adaptive profile',
  'Operating system',
  'ATLAS'
] as const;

export const ATLAS_RECOVERY_PIPELINE = [
  'Power',
  'Device DNA',
  'Failure detected',
  'Phoenix mode',
  'Diagnose',
  'Repair',
  'Verify',
  'Boot'
] as const;

export const ATLAS_HARDWARE_CONCEPTS: readonly AtlasHardwareConcept[] = [
  {
    id: 'device-dna',
    name: 'ATLAS Device DNA',
    category: 'Firmware intelligence',
    purpose: 'Canonical hardware identity, capability inventory and truthful readiness model before higher-level ATLAS services execute.',
    status: 'software-surface',
    dependency: 'Native firmware and signed telemetry adapters are still required for real pre-boot hardware inspection.'
  },
  {
    id: 'phoenix',
    name: 'ATLAS Phoenix',
    category: 'Recovery',
    purpose: 'Independent recovery path for boot, storage, memory, driver, malware and snapshot repair workflows.',
    status: 'software-surface',
    dependency: 'Bootable recovery image, secure update chain and hardware-specific repair adapters are required.'
  },
  {
    id: 'rescue-key',
    name: 'ATLAS Rescue Key',
    category: 'Field service',
    purpose: 'Portable authorized rescue environment for diagnostics, recovery, cloning and ATLAS OS installation.',
    status: 'prototype-required',
    dependency: 'Dedicated secure hardware, signed boot image and recovery authorization model.'
  },
  {
    id: 'core',
    name: 'ATLAS Core',
    category: 'Modular compute',
    purpose: 'Portable compute and identity module designed to move a governed ATLAS workspace between compatible shells.',
    status: 'prototype-required',
    dependency: 'Hardware reference design, high-speed interconnect, thermal envelope and secure-element design.'
  },
  {
    id: 'shell',
    name: 'ATLAS Shell',
    category: 'Laptop',
    purpose: 'Long-life display, keyboard, battery and I/O chassis that can be upgraded by replacing the compute core rather than the entire laptop.',
    status: 'prototype-required',
    dependency: 'Mechanical, electrical, repairability and modular interconnect validation.'
  },
  {
    id: 'neural-dock',
    name: 'ATLAS Neural Dock',
    category: 'Workspace',
    purpose: 'Context-aware dock that applies approved workspace, display, network and peripheral policy when a device is attached.',
    status: 'prototype-required',
    dependency: 'Dock controller hardware and signed peripheral policy adapters.'
  },
  {
    id: 'halo',
    name: 'ATLAS Halo',
    category: 'Ambient assistant',
    purpose: 'Desk-side ATLAS presence with explicit physical privacy disconnects for camera and microphone hardware.',
    status: 'prototype-required',
    dependency: 'Microphone array, camera, speaker, local privacy circuit and secure wake path.'
  },
  {
    id: 'vision',
    name: 'ATLAS Vision',
    category: 'Spatial',
    purpose: 'Wearable contextual assistance for maintenance, inventory, translation, navigation and visual diagnostics.',
    status: 'research-track',
    dependency: 'Optics, thermal, battery, camera and on-device privacy feasibility research.'
  },
  {
    id: 'fieldpad',
    name: 'ATLAS FieldPad',
    category: 'Rugged operations',
    purpose: 'Rugged offline-first tablet for inventory, hospitality, logistics, maintenance, signatures and mobility operations.',
    status: 'prototype-required',
    dependency: 'Rugged enclosure, replaceable battery, cellular/GNSS/NFC and scanner reference hardware.'
  },
  {
    id: 'mesh',
    name: 'ATLAS Mesh Nodes',
    category: 'Local network',
    purpose: 'Local-first coordination for sites that must keep approved operations available during upstream internet loss.',
    status: 'prototype-required',
    dependency: 'Secure mesh transport, provisioning hardware and offline conflict-resolution validation.'
  },
  {
    id: 'adaptive-computing',
    name: 'ATLAS Adaptive Computing',
    category: 'Performance',
    purpose: 'Capability-based runtime profiles that scale ATLAS from constrained legacy devices to high-performance workstations.',
    status: 'software-surface',
    dependency: 'Real telemetry must come from an authorized local adapter before a device profile is treated as live.'
  }
] as const;

export type AtlasAdaptiveProfile = 'lite' | 'standard' | 'performance';

export function classifyAdaptiveProfile(input: {
  memoryGb: number;
  logicalCores: number;
  localAiCapable?: boolean;
}): AtlasAdaptiveProfile {
  if (input.memoryGb <= 4 || input.logicalCores <= 2) return 'lite';
  if (input.memoryGb >= 16 && input.logicalCores >= 8 && input.localAiCapable) return 'performance';
  return 'standard';
}

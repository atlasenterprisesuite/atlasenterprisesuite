export const OS_NOTIFICATION_CLASSES = ['security', 'system', 'collaboration', 'finance', 'people', 'operations'] as const;
export type OsNotificationClass = (typeof OS_NOTIFICATION_CLASSES)[number];
export type DeviceActionsMode = 'deny' | 'confirm' | 'allow';

export type PersonalOsSettings = {
  syncEnabled: boolean;
  crossDeviceHandoffEnabled: boolean;
  offlineDraftsEnabled: boolean;
  autoBackupEnabled: boolean;
  backupRetentionDays: number;
  notificationsEnabled: boolean;
  notificationClasses: OsNotificationClass[];
};

export type OrganizationOsPolicy = {
  forceBackupEnabled: boolean;
  minimumBackupRetentionDays: number;
  requireVerifiedAdapters: boolean;
  crossDeviceHandoffAllowed: boolean;
  deviceActionsMode: DeviceActionsMode;
};

export type EffectiveOsSettings = PersonalOsSettings & {
  requireVerifiedAdapters: boolean;
  deviceActionsMode: DeviceActionsMode;
};

export const DEFAULT_PERSONAL_OS_SETTINGS: PersonalOsSettings = Object.freeze({
  syncEnabled: true,
  crossDeviceHandoffEnabled: true,
  offlineDraftsEnabled: true,
  autoBackupEnabled: false,
  backupRetentionDays: 30,
  notificationsEnabled: true,
  notificationClasses: ['security', 'system', 'collaboration']
});

export const DEFAULT_ORGANIZATION_OS_POLICY: OrganizationOsPolicy = Object.freeze({
  forceBackupEnabled: false,
  minimumBackupRetentionDays: 7,
  requireVerifiedAdapters: true,
  crossDeviceHandoffAllowed: true,
  deviceActionsMode: 'confirm'
});

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

export function normalizePersonalOsSettings(value: unknown): PersonalOsSettings {
  const input = object(value);
  const requestedClasses = Array.isArray(input.notificationClasses) ? input.notificationClasses : DEFAULT_PERSONAL_OS_SETTINGS.notificationClasses;
  const notificationClasses = [...new Set(requestedClasses.filter(
    (item): item is OsNotificationClass => typeof item === 'string' && (OS_NOTIFICATION_CLASSES as readonly string[]).includes(item)
  ))];

  return {
    syncEnabled: bool(input.syncEnabled, DEFAULT_PERSONAL_OS_SETTINGS.syncEnabled),
    crossDeviceHandoffEnabled: bool(input.crossDeviceHandoffEnabled, DEFAULT_PERSONAL_OS_SETTINGS.crossDeviceHandoffEnabled),
    offlineDraftsEnabled: bool(input.offlineDraftsEnabled, DEFAULT_PERSONAL_OS_SETTINGS.offlineDraftsEnabled),
    autoBackupEnabled: bool(input.autoBackupEnabled, DEFAULT_PERSONAL_OS_SETTINGS.autoBackupEnabled),
    backupRetentionDays: boundedInteger(input.backupRetentionDays, DEFAULT_PERSONAL_OS_SETTINGS.backupRetentionDays, 1, 365),
    notificationsEnabled: bool(input.notificationsEnabled, DEFAULT_PERSONAL_OS_SETTINGS.notificationsEnabled),
    notificationClasses
  };
}

export function normalizeOrganizationOsPolicy(value: unknown): OrganizationOsPolicy {
  const input = object(value);
  const requestedMode = typeof input.deviceActionsMode === 'string' ? input.deviceActionsMode : DEFAULT_ORGANIZATION_OS_POLICY.deviceActionsMode;
  const deviceActionsMode: DeviceActionsMode = ['deny', 'confirm', 'allow'].includes(requestedMode)
    ? requestedMode as DeviceActionsMode
    : DEFAULT_ORGANIZATION_OS_POLICY.deviceActionsMode;

  return {
    forceBackupEnabled: bool(input.forceBackupEnabled, DEFAULT_ORGANIZATION_OS_POLICY.forceBackupEnabled),
    minimumBackupRetentionDays: boundedInteger(input.minimumBackupRetentionDays, DEFAULT_ORGANIZATION_OS_POLICY.minimumBackupRetentionDays, 1, 365),
    requireVerifiedAdapters: bool(input.requireVerifiedAdapters, DEFAULT_ORGANIZATION_OS_POLICY.requireVerifiedAdapters),
    crossDeviceHandoffAllowed: bool(input.crossDeviceHandoffAllowed, DEFAULT_ORGANIZATION_OS_POLICY.crossDeviceHandoffAllowed),
    deviceActionsMode
  };
}

export function effectiveOsSettings(personalInput: unknown, organizationInput: unknown): EffectiveOsSettings {
  const personal = normalizePersonalOsSettings(personalInput);
  const policy = normalizeOrganizationOsPolicy(organizationInput);
  return {
    ...personal,
    autoBackupEnabled: personal.autoBackupEnabled || policy.forceBackupEnabled,
    backupRetentionDays: Math.max(personal.backupRetentionDays, policy.minimumBackupRetentionDays),
    crossDeviceHandoffEnabled: personal.crossDeviceHandoffEnabled && policy.crossDeviceHandoffAllowed,
    requireVerifiedAdapters: policy.requireVerifiedAdapters,
    deviceActionsMode: policy.deviceActionsMode
  };
}

export function canManageOrganizationOsSettings(role: string | null | undefined) {
  return role === 'owner' || role === 'admin';
}

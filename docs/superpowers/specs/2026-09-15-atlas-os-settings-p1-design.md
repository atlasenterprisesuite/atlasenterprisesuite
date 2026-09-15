# ATLAS OS Settings P1 Design

## Goal

Implement `os.settings` as a real, identity-scoped ATLAS capability for personal OS preferences and organization policy without pretending that Windows, macOS, iOS/iPadOS, Android, kernel, driver, push, SMS, backup or sync adapters are connected when they are not verified.

## Ownership and trust boundary

ATLAS is the source of truth. The authenticated user is derived from `auth.uid()` inside PostgreSQL RPCs. The active organization is selected server-side from an active `organization_members` row, preferring the user's canonical `atlas_user_preferences.default_org_id` when that membership is still active. Browser requests never choose the tenant for a settings mutation.

Personal OS settings are stored as the `os` namespace inside the existing `atlas_user_preferences.preferences` JSON document. Organization OS policy is stored as the `os` namespace inside the existing `organization_settings.settings` JSON document and is writable by this RPC only when the active role is `owner` or `admin`. Both canonical settings rows gain an `os_settings_version` counter for optimistic concurrency. OS settings updates write into the existing `audit_logs` rail instead of creating another audit subsystem.

## Personal settings

- Sync eligibility
- Cross-device handoff eligibility
- Offline-tolerant drafts
- Automatic restore-point preference
- Backup retention preference, bounded to 1–365 days
- In-app notification eligibility
- Notification classes: security, system, collaboration, finance, people and operations

## Organization policy

- Require backups
- Minimum backup retention, bounded to 1–365 days
- Require verified native adapters
- Allow/disallow cross-device handoff
- Device action mode: deny, require confirmation, or allow when independently authorized

Organization policy may only make the effective result stricter. It cannot manufacture connectivity or give a user more permission than Identity/RBAC grants.

## Persistence and concurrency

The implementation reuses the existing RLS-protected `atlas_user_preferences` and `organization_settings` tables and the existing `audit_logs` table. The migration does not introduce parallel OS settings or OS audit tables.

Writes go through `update_os_settings`, which derives identity, resolves active organization membership, normalizes settings, checks `expected_version`, changes only the nested `os` namespace while preserving other settings owned by other ATLAS modules, increments `os_settings_version`, and records `os.settings.update` in `audit_logs`.

`get_os_settings` returns normalized personal and organization settings plus truthful native-adapter status. Until a real adapter writes independently verified evidence, Windows, macOS, iOS and Android delivery states remain `not_verified`.

## Web experience

`/settings` is protected by `RequireAtlasIdentity` and is reachable from the global shell. It must expose loading, error, success and conflict states; personal settings; organization policy; effective-policy preview; adapter status; reload; and JSON export. The layout must remain usable on desktop, tablet and mobile.

## Integration boundary

This capability persists policy now. Sync, Backup, Notifications and Device Registry may consume this contract when those capabilities are present in the canonical runtime. The Settings UI explicitly states that persisted policy is not evidence that those downstream capabilities or native adapters are deployed.

## Completion gate

Code and tests are not production evidence. `os.settings` remains `planned-or-existing-unverified` until migration deployment, authenticated read/write exercise, cross-user/cross-tenant denial, owner/admin vs member authorization, audit persistence, responsive verification and production-route verification are recorded.

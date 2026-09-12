# ATLAS Mail, Groups & Account Recovery — Design Specification

**Date:** 2026-09-12  
**Status:** Approved design, pending implementation plan  
**Repository:** `atlasenterprisesuite/atlasenterprisesuite`  
**Target branch for this design:** `feat/atlas-mail-identity-security`

## 1. Purpose

ATLAS needs an enterprise communication and identity surface that can support organizational email, shared groups, shared resources, provider-backed storage visibility, and secure account-recovery workflows without duplicating external providers or fabricating connected state.

The design is based on approved visual references showing:

- a Gmail-style mailbox experience;
- provider storage reporting showing 2 TB total capacity with real usage;
- shared-group capabilities such as calendars, lists and shared credentials;
- delayed account-recovery / security-hold behavior.

These references are product specifications, not assets to embed or imitate pixel-for-pixel.

## 2. Scope and decomposition

This is an umbrella architecture with four independently testable implementation slices that share one identity, tenancy, permissions and audit model:

1. **ATLAS Mail Core** — personal inboxes, shared inboxes, aliases, folders/labels, search, compose, send, reply, forward, attachments and provider connection state.
2. **ATLAS Groups & Shared Access** — organization groups, team membership, shared mail, calendars, lists and shared vault access.
3. **ATLAS Storage Visibility** — provider-backed quota and usage reporting with strict evidence gates.
4. **ATLAS Account Recovery** — recovery requests, security holds, countdowns, cancellation, verification and restoration state.

The implementation plan must preserve these boundaries. No slice may claim another slice is complete merely because its UI is present.

## 3. Existing ATLAS context

The canonical repository already has:

- a React/Vite web application in `apps/web`;
- a shared shell and authenticated organization context;
- Supabase as the primary backend/control-plane direction;
- explicit organization/tenant isolation and RBAC requirements;
- auditability requirements for sensitive operations;
- a rule that connected/live/verified status must reflect real provider evidence.

No existing ATLAS Mail, organization-groups, provider-storage or account-recovery module currently provides the full behavior described here. New work must extend the existing shell and identity/session architecture instead of creating a parallel app or identity system.

## 4. Product ownership

### Primary owner

`Identity / Organization`

Identity owns:

- users;
- organizations/tenants;
- group membership;
- roles and permissions;
- provider connection identity;
- security state;
- recovery state;
- access audit records.

### Secondary modules

- `ATLAS Mail` — message operations and shared inboxes.
- `ATLAS Calendar` — group calendars and event access.
- `ATLAS Vault` — controlled secret sharing.
- `Notifications` — recovery and security notifications.
- `Audit Trail` — immutable security-sensitive event history.
- `ATLAS Drive` or storage adapter surfaces — provider file/quota visibility when available.

## 5. Navigation model

### Identity navigation

`ATLAS -> Identity -> Organization -> Groups -> Group Detail`

Group Detail tabs:

- Overview
- Members
- Mail
- Calendar
- Lists
- Vault
- Permissions
- Audit
- Settings

### Mail navigation

`ATLAS -> Mail`

Primary Mail sections:

- Inbox
- Starred / Important when provider semantics exist
- Sent
- Drafts
- Scheduled when supported
- Archive
- Spam
- Trash
- Shared Inboxes
- Groups
- Aliases
- Storage
- Settings

### Security navigation

`ATLAS -> Identity -> Security -> Account Recovery`

Recovery detail states:

`Requested -> Verification -> Security Hold -> Link Available -> Restored`

Terminal alternative states:

- Cancelled
- Expired
- Failed
- Locked for review

## 6. ATLAS Mail Core

### 6.1 Mailbox behavior

ATLAS Mail must support, when enabled by a real provider integration:

- message list with sender, subject, preview, timestamp and read/unread state;
- thread/conversation view;
- compose;
- reply and reply-all;
- forward;
- attachments;
- search;
- provider-backed folders or normalized system categories;
- archive;
- trash;
- spam handling;
- labels/tags where the provider exposes them;
- pagination or cursor-based retrieval;
- loading, empty, error and disconnected states.

The first implementation may use provider adapters rather than an ATLAS-hosted SMTP/IMAP service. ATLAS must not pretend to host mailboxes unless the infrastructure actually does so.

### 6.2 Corporate addresses

ATLAS must be able to represent:

- individual addresses, for example `user@atlasenterprisesuite.com`;
- aliases, for example `billing@atlasenterprisesuite.com`;
- group addresses, for example `finance@atlasenterprisesuite.com`;
- shared inboxes, for example `support@atlasenterprisesuite.com`.

Creating, deleting or modifying a real mailbox/alias must occur through an authorized provider adapter. If no provider write integration exists, ATLAS may manage the requested configuration state and show the exact external dependency, but it must not report the address as provisioned.

### 6.3 Shared inbox permissions

Shared inbox capabilities must be role-gated. Minimum permission concepts:

- `mail.read`
- `mail.compose`
- `mail.send`
- `mail.manage_labels`
- `mail.manage_shared_inbox`
- `mail.manage_aliases`
- `mail.view_storage`

Actions must be scoped by organization and mailbox resource.

## 7. ATLAS Groups & Shared Access

### 7.1 Group types

Use one generic group model rather than separate family/team implementations.

Supported semantic group types:

- department;
- project team;
- operating group;
- private group;
- household/family, if a consumer-facing tenant uses it later.

Group type changes presentation and default policies, not the underlying security boundary.

### 7.2 Group membership

A group has:

- `group_id`;
- `organization_id`;
- name;
- type;
- owner;
- administrators;
- members;
- status;
- created/updated timestamps.

Membership has:

- user identity;
- role;
- invitation state;
- join timestamp;
- removal timestamp when applicable;
- per-resource overrides only when necessary.

### 7.3 Shared resources

A group may link to:

- one or more shared inboxes;
- one or more shared calendars;
- lists/tasks/notes;
- vault collections;
- files/folders from supported providers.

The group stores authorization relationships, not copies of provider data unless synchronization is explicitly required.

### 7.4 Group dangerous actions

Actions such as:

- remove member;
- transfer ownership;
- leave group;
- delete group;
- revoke shared-vault access;

must require authorization checks and create audit records. Ownership transfer and group deletion require explicit confirmation and recent authentication. A group with dependent resources must surface those dependencies before deletion.

## 8. ATLAS Vault integration

The shared-credential concept from the reference must be implemented through ATLAS Vault security boundaries, not through plaintext shared-password fields.

Rules:

- passwords, tokens, recovery codes and private keys are never displayed from application logs or committed to source;
- secrets are encrypted at rest and transmitted through approved secure channels;
- users receive access to a vault item or collection, not a copied secret record owned by the group UI;
- access, reveal, update and revocation events are audited;
- a user without permission sees metadata or an access-denied state, never secret value leakage.

## 9. Provider-backed storage visibility

### 9.1 Evidence rule

ATLAS may display quota and usage only from a current provider response or an explicitly timestamped cached provider record.

The approved reference currently demonstrates a Google account with:

- **2 TB total capacity**;
- **31.33 GB total used** at the time of the reference;
- visible service breakdown including Google Drive and Gmail.

These values are reference evidence, not hard-coded production defaults. ATLAS must not permanently store `2 TB` as the account plan unless the provider confirms it for the connected identity.

### 9.2 Storage UI

The Storage view must support:

- total capacity;
- total used;
- free/remaining capacity when derivable;
- percentage used;
- provider name;
- last verified timestamp;
- category/service breakdown if provider exposes it;
- refresh state;
- stale-data warning;
- unavailable/no-permission state.

### 9.3 Normalized storage contract

Provider adapters should normalize to a structure equivalent to:

```ts
interface StorageQuotaSnapshot {
  provider: string;
  accountId: string;
  organizationId: string;
  usedBytes: number | null;
  totalBytes: number | null;
  breakdown: Array<{
    category: string;
    usedBytes: number | null;
  }>;
  verifiedAt: string;
  source: 'provider_api' | 'provider_admin' | 'manual_evidence';
  status: 'verified' | 'stale' | 'unavailable' | 'permission_denied';
}
```

Manual evidence may support an administrative record, but must never be presented as live API state.

## 10. Account Recovery & Security Hold

### 10.1 Purpose

ATLAS must provide a secure recovery workflow for identities that lose normal access. The visual reference demonstrates an external provider imposing a timed security hold before a recovery link becomes available. ATLAS should support the same security concept without copying provider-specific branding or assuming a fixed six-hour delay.

### 10.2 Recovery states

Canonical recovery states:

- `requested`
- `verifying`
- `security_hold`
- `recovery_available`
- `restored`
- `cancelled`
- `expired`
- `failed`
- `manual_review`

### 10.3 Recovery request record

A recovery request must contain at least:

- recovery request ID;
- user ID;
- organization ID when applicable;
- channel/provider;
- request timestamp;
- hold-until timestamp when used;
- state;
- requesting device/session metadata where lawful and available;
- network metadata where lawful and available;
- verification method;
- cancellation timestamp;
- completion timestamp;
- risk decision/result;
- audit references.

### 10.4 Countdown behavior

The countdown shown in UI must be derived from authoritative server timestamps. It must not depend only on a browser timer.

If the server says a hold ends at `hold_until`, the client displays the remaining duration. Refreshing the page must preserve the same recovery state.

### 10.5 Cancellation

A user must be able to cancel a recovery request when permitted.

Cancellation requires:

- verification of the current request identity;
- recent authentication or another approved verification step when available;
- an audit record;
- security notification to approved channels.

Cancellation is irreversible for that request instance; a new recovery request creates a new ID.

### 10.6 Sensitive-change freeze

While a high-risk recovery request is in `security_hold`, ATLAS may block or require step-up verification for actions such as:

- password changes;
- recovery-channel changes;
- passkey removal;
- MFA reset;
- organization-owner transfer;
- vault-policy changes;
- creation of new privileged API credentials.

The specific freeze policy must be configurable by organization security policy rather than hard-coded globally.

### 10.7 Restoration

ATLAS may mark access `restored` only after authoritative confirmation that the recovery operation succeeded. Delivery of a link alone is not restoration.

## 11. Authentication, RBAC and tenancy

Every request must resolve:

- authenticated user/session when present;
- organization/tenant;
- resource ownership;
- effective permissions;
- provider connection ownership.

No mail, group, storage or recovery record may be accessible across organizations unless an explicit cross-organization sharing model is later approved.

Supabase Row Level Security should enforce tenant boundaries for ATLAS-owned records. Provider tokens must remain server-side or in an approved secure token store.

## 12. Data model direction

The implementation plan should inspect existing identity/session tables before adding schema. If no equivalent exists, the likely new ATLAS-owned records are:

- `organization_groups`
- `organization_group_members`
- `communication_accounts`
- `mailbox_resources`
- `mailbox_access_grants`
- `provider_connection_metadata`
- `storage_quota_snapshots`
- `account_recovery_requests`
- `security_events`

This list is architectural, not permission to duplicate equivalent tables already present in the repository.

## 13. Provider adapter boundary

External systems must sit behind adapters. Example capability interface:

```ts
interface MailProviderAdapter {
  getConnectionStatus(): Promise<ProviderConnectionStatus>;
  listMessages(input: MailListInput): Promise<MailPage>;
  getThread(threadId: string): Promise<MailThread>;
  sendMessage(input: SendMailInput): Promise<SendResult>;
  modifyMessage(input: ModifyMailInput): Promise<ModifyResult>;
  getStorageQuota?(): Promise<StorageQuotaSnapshot>;
  manageAlias?(input: AliasMutation): Promise<AliasMutationResult>;
}
```

Capabilities are optional by provider. The UI must disable or omit unsupported operations rather than simulate success.

Potential providers may include Gmail/Google Workspace, Microsoft Outlook/Microsoft 365, or future ATLAS-hosted mail. No provider is considered production-connected until authorization and runtime probes verify it.

## 14. Audit model

Security-sensitive events must include:

- actor;
- organization;
- resource;
- action;
- result;
- timestamp;
- relevant request/correlation ID;
- provider reference when available;
- before/after metadata for policy changes without logging secrets.

Audit coverage must include at least:

- send-as/shared-inbox changes;
- alias changes;
- group membership/ownership changes;
- vault access changes;
- storage connection changes;
- recovery request creation;
- recovery cancellation;
- recovery completion;
- security-policy overrides.

## 15. UX and responsive behavior

The approved references provide interaction patterns, not ATLAS branding.

ATLAS UI requirements:

- retain official ATLAS visual identity and shell;
- desktop layout may use persistent sidebar plus message/resource pane;
- tablet collapses secondary navigation as needed;
- mobile uses single-column navigation with reliable back/breadcrumb behavior;
- all actionable controls expose loading, disabled, success and error states;
- destructive actions use explicit confirmation;
- connection state and verification timestamps are visible where relevant;
- accessibility must support keyboard navigation, screen readers, focus states and sufficient semantic labeling.

## 16. Error and empty-state behavior

Examples:

- no provider connected -> configuration state, not empty fake mailbox;
- provider authorization expired -> reconnect-required state;
- no messages -> legitimate empty inbox;
- storage permission unavailable -> quota unavailable, never `0 GB`;
- group has no members beyond owner -> real member-empty state;
- recovery request not found -> safe generic error without identity leakage;
- recovery hold active -> show server-derived remaining time;
- provider outage -> degraded/unavailable state with retry behavior.

## 17. Testing requirements

### Unit tests

- permission evaluation;
- normalized provider mapping;
- storage percentage/free-space calculations;
- recovery state transitions;
- server-time countdown calculation;
- deletion/ownership-transfer guards;
- capability gating.

### Integration tests

- authenticated organization context reaches Mail/Groups/Recovery routes;
- RLS prevents cross-tenant reads/writes;
- shared inbox permissions enforce read/send distinctions;
- recovery cancellation writes audit evidence;
- stale provider snapshots are labeled stale;
- provider adapter errors do not produce false success.

### UI tests

- desktop/tablet/mobile navigation;
- compose validation;
- search and folder changes;
- shared inbox selection;
- group member management;
- storage verified/stale/unavailable states;
- recovery requested/hold/available/cancelled states;
- keyboard/focus behavior for critical actions.

### Repository validation

Before completion of any implementation slice:

```bash
npm run typecheck
npm test
npm run build
```

Additionally verify affected routes, authorization boundaries and absence of secrets.

## 18. Production verification gates

No capability may be labeled `live`, `connected`, `verified`, `provisioned` or `restored` without evidence.

Separate status dimensions:

- code implemented;
- tests passing;
- database migration applied;
- provider authorized;
- provider runtime probe successful;
- deployment completed;
- public route verified.

A successful build is not a successful provider connection or production deployment.

## 19. Implementation sequence

The implementation plan should decompose work in this order:

1. identity/group data contracts and permission model;
2. route/navigation shell for Mail, Groups and Security Recovery;
3. provider-adapter interfaces and truthful disconnected states;
4. ATLAS Mail read/search/thread flows;
5. compose/send mutation path;
6. shared inboxes, groups and alias authorization;
7. storage quota snapshot contract and UI;
8. recovery state machine and server-authoritative hold timer;
9. recovery cancellation, security freeze and audit events;
10. full responsive/accessibility and regression validation;
11. provider-specific production integration only where authorized.

Provider writes, paid services, domain/mailbox provisioning and production deployment remain explicit authorization gates.

## 20. Non-goals for the first implementation cycle

The first implementation cycle does not require:

- building a new SMTP server;
- building a new IMAP server;
- replacing Gmail or Microsoft 365 storage infrastructure;
- inventing mailbox content or quotas;
- implementing unsupported provider administration APIs;
- storing plaintext shared passwords;
- automatically provisioning paid provider seats;
- performing domain/DNS changes without explicit approval;
- bypassing external provider security holds.

## 21. Acceptance criteria

The architecture is satisfied when:

1. ATLAS exposes coherent Mail, Groups and Account Recovery routes inside the existing shell.
2. All records are tenant-scoped and permission-gated.
3. Mail provider state is real and capability-gated.
4. Shared inboxes and groups distinguish read/send/admin permissions.
5. Shared credentials use Vault boundaries and never plaintext storage.
6. Storage usage is provider-backed or explicitly labeled as manual/stale evidence.
7. The 2 TB reference is not hard-coded as a universal quota.
8. Recovery holds are server-authoritative and persist across refreshes.
9. Recovery cancellation and completion are audited.
10. Sensitive actions during recovery can be frozen or step-up gated by policy.
11. UI has real loading, empty, disabled, error and success states.
12. Typecheck, tests and build pass for each completed slice.
13. Production status remains separate from code/test status until runtime evidence exists.

## 22. Final design decision

ATLAS will not implement separate Gmail-clone, Family-clone and Recovery-clone applications. It will implement one connected **Identity + Communications architecture** in which Mail, Groups, Storage and Recovery reuse the same authenticated organization context, RBAC, provider adapter boundaries, audit trail and production-truth rules.

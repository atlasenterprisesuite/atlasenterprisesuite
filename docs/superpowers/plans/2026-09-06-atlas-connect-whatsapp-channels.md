# ATLAS Connect + WhatsApp Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a truthful ATLAS Creator Studio + ATLAS Connect publishing flow for the official `Atlas Enterprise Suite News` WhatsApp Channel, beginning with verified manual handoff and explicit publication confirmation.

**Architecture:** Add a small provider-neutral `packages/connect` domain that owns publication types, state transitions, validation, destination capability truth, local development persistence, permission checks, receipts, and audit events. Add focused React routes under `apps/web/src/modules/studio` and `apps/web/src/modules/connect` that consume those contracts. Keep WhatsApp Channels in `manual_handoff` until a real provider adapter can publish and return verifiable evidence.

**Tech Stack:** TypeScript 5.7, React 18, React Router, Vite 6, Vitest 3, Testing Library, browser `localStorage` through an injectable storage interface.

**Spec:** `docs/superpowers/specs/2026-09-06-atlas-connect-whatsapp-channels-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Implement on `feat/atlas-connect-whatsapp-channels`; do not write directly to `main`.
- Official destination URL: `https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32`.
- Initial WhatsApp Channel capability is exactly `manual_handoff`.
- Never equate opening WhatsApp with publication success.
- Never store WhatsApp credentials, provider tokens, cookies, passwords, or session material.
- Browser-local persistence must display `Development local persistence — not tenant-safe production storage`.
- Do not introduce a second ATLAS shell, repository, app, routing framework, or provider-specific UI dependency.
- Automated external publication remains disabled until a real authorization adapter and provider receipt are available.
- Preserve existing Finance and Health routes and their tests.
- Required release gates: `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm test`, and `npm run build`.

---

## File Map

### Domain package
- `packages/connect/types.ts` — canonical publication, destination, receipt, audit, and permission types.
- `packages/connect/fingerprint.ts` — deterministic fingerprint input normalization and hash function.
- `packages/connect/state.ts` — publication state transition guard/reducer.
- `packages/connect/validation.ts` — destination/content validation before `ready`.
- `packages/connect/destinations.ts` — destination registry and official WhatsApp Channel definition.
- `packages/connect/permissions.ts` — permission interface and development capability adapter.
- `packages/connect/storage.ts` — versioned storage interface and browser-local implementation.
- `packages/connect/service.ts` — application service coordinating save, ready, handoff, confirm, receipt, and audit.

### Web modules
- `apps/web/src/modules/studio/StudioHome.tsx` — Creator Studio entry.
- `apps/web/src/modules/studio/PublishPage.tsx` — compose, validate, preview, save, handoff, and confirmation flow.
- `apps/web/src/modules/connect/ConnectHome.tsx` — ATLAS Connect entry.
- `apps/web/src/modules/connect/DestinationsPage.tsx` — destination list and capability state.
- `apps/web/src/modules/connect/WhatsAppChannelPage.tsx` — channel truth/capability detail.
- `apps/web/src/modules/connect/PublicationsPage.tsx` — receipts and audit-oriented publication history.
- `apps/web/src/components/AtlasShell.tsx` — add Creator Studio and Connect navigation.
- `apps/web/src/App.tsx` — register the six new routes and home cards.
- `apps/web/src/styles.css` — responsive publishing/destination UI states using existing ATLAS visual language.

### Tests
- `tests/unit/connect-publication.test.ts` — state machine, validation, destination registry, permissions, fingerprint.
- `tests/unit/connect-storage.test.ts` — versioned local store and secret-rejection behavior.
- `tests/integration/connect-publish-flow.test.tsx` — route graph and user-visible manual handoff/confirmation semantics.

---

### Task 1: Publication contracts, fingerprint, state machine, and validation

**Files:**
- Create: `packages/connect/types.ts`
- Create: `packages/connect/fingerprint.ts`
- Create: `packages/connect/state.ts`
- Create: `packages/connect/validation.ts`
- Create: `tests/unit/connect-publication.test.ts`

**Interfaces:**
- Produces `PublicationCapability`, `PublicationStatus`, `ReceiptVerification`, `PublishDestination`, `PublishContentType`, `PublishDraft`, `PublicationReceipt`, `PublicationAuditEvent`, `AtlasPermission`.
- Produces `fingerprintDraft(draft: Pick<PublishDraft, 'title' | 'body' | 'link' | 'contentType' | 'attachment'>): string`.
- Produces `transitionPublication(status: PublicationStatus, action: PublicationAction): PublicationStatus`.
- Produces `validateDraftForDestination(draft: PublishDraft, destination: PublishDestination): ValidationResult`.

- [ ] **Step 1: Write failing domain tests**

Create `tests/unit/connect-publication.test.ts` with these first assertions:

```ts
import { describe, expect, it } from 'vitest';
import { fingerprintDraft } from '../../packages/connect/fingerprint';
import { transitionPublication } from '../../packages/connect/state';
import { validateDraftForDestination } from '../../packages/connect/validation';
import type { PublishDestination, PublishDraft } from '../../packages/connect/types';

const destination: PublishDestination = {
  id: 'whatsapp-channel-atlas-news',
  platform: 'whatsapp_channel',
  name: 'Atlas Enterprise Suite News',
  capability: 'manual_handoff',
  publicUrl: 'https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32',
  provider: 'none_verified_for_channel_publish',
  supportedContentTypes: ['text', 'link', 'image', 'video']
};

const draft: PublishDraft = {
  id: 'draft-1',
  title: 'Launch update',
  body: 'ATLAS Connect is entering review.',
  link: 'https://atlasenterprisesuite.com',
  contentType: 'link',
  attachment: null,
  destinationId: destination.id,
  status: 'draft',
  fingerprint: null,
  createdAt: '2026-09-06T20:30:00-04:00',
  updatedAt: '2026-09-06T20:30:00-04:00'
};

describe('ATLAS Connect publication domain', () => {
  it('creates the same fingerprint for equivalent reviewed content', () => {
    expect(fingerprintDraft(draft)).toBe(fingerprintDraft({ ...draft }));
  });

  it('allows draft -> ready -> awaiting_manual_publish -> published only through explicit actions', () => {
    expect(transitionPublication('draft', 'mark_ready')).toBe('ready');
    expect(transitionPublication('ready', 'start_manual_handoff')).toBe('awaiting_manual_publish');
    expect(transitionPublication('awaiting_manual_publish', 'confirm_manual_publish')).toBe('published');
    expect(() => transitionPublication('ready', 'confirm_manual_publish')).toThrow(/invalid publication transition/i);
  });

  it('rejects empty content and accepts a valid link draft', () => {
    expect(validateDraftForDestination({ ...draft, body: '', link: null }, destination).valid).toBe(false);
    expect(validateDraftForDestination(draft, destination).valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test:unit -- --run tests/unit/connect-publication.test.ts
```

Expected: FAIL because `packages/connect/*` modules do not exist.

- [ ] **Step 3: Implement canonical types**

Create `packages/connect/types.ts` with exact unions and records:

```ts
export type PublicationCapability = 'manual_handoff' | 'provider_publish' | 'unavailable';
export type PublicationStatus = 'draft' | 'ready' | 'awaiting_manual_publish' | 'publishing' | 'published' | 'failed';
export type ReceiptVerification = 'manual_confirmation' | 'provider_verified';
export type PublishContentType = 'text' | 'link' | 'image' | 'video' | 'audio' | 'poll';
export type PublicationAction = 'mark_ready' | 'start_manual_handoff' | 'start_provider_publish' | 'confirm_manual_publish' | 'provider_succeeded' | 'fail' | 'retry';
export type AtlasPermission =
  | 'studio.draft.create'
  | 'studio.draft.edit'
  | 'connect.destination.read'
  | 'connect.publish.request'
  | 'connect.publish.confirm_manual'
  | 'connect.publish.retry'
  | 'connect.audit.read';

export interface PublishAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  objectUrl?: string;
}

export interface PublishDestination {
  id: string;
  platform: 'whatsapp_channel' | 'whatsapp_business' | 'instagram' | 'facebook' | 'x' | 'other';
  name: string;
  capability: PublicationCapability;
  publicUrl?: string;
  provider?: string;
  supportedContentTypes: PublishContentType[];
}

export interface PublishDraft {
  id: string;
  title: string;
  body: string;
  link: string | null;
  contentType: PublishContentType;
  attachment: PublishAttachment | null;
  destinationId: string;
  status: PublicationStatus;
  fingerprint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicationReceipt {
  id: string;
  publicationId: string;
  destinationId: string;
  verification: ReceiptVerification;
  fingerprint: string;
  actor: string;
  createdAt: string;
  providerReference: string | null;
}

export interface PublicationAuditEvent {
  id: string;
  publicationId: string;
  destinationId: string;
  capability: PublicationCapability;
  fingerprint: string | null;
  action: 'draft_saved' | 'marked_ready' | 'handoff_started' | 'manual_publish_confirmed' | 'provider_publish_started' | 'provider_publish_succeeded' | 'publication_failed';
  actor: string;
  timestamp: string;
  outcome: 'success' | 'failure';
  verification: ReceiptVerification | null;
  providerReference: string | null;
  error: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

- [ ] **Step 4: Implement deterministic fingerprint and transition guard**

`packages/connect/fingerprint.ts` must normalize `title`, `body`, `link`, `contentType`, attachment name/mime/size, serialize keys in fixed order, and return a deterministic browser-safe FNV-1a hex digest prefixed `fp1_`. It must not include mutable timestamps or object URLs.

`packages/connect/state.ts` must implement this transition map exactly:

```ts
const transitions = {
  draft: { mark_ready: 'ready' },
  ready: { start_manual_handoff: 'awaiting_manual_publish', start_provider_publish: 'publishing', fail: 'failed' },
  awaiting_manual_publish: { confirm_manual_publish: 'published', fail: 'failed' },
  publishing: { provider_succeeded: 'published', fail: 'failed' },
  failed: { retry: 'ready' },
  published: {}
} as const;
```

Invalid transitions throw `Error('Invalid publication transition: <status> -> <action>')`.

- [ ] **Step 5: Implement validation**

`packages/connect/validation.ts` must reject:
- missing destination id match;
- unsupported content type;
- both body and link blank for text/link posts;
- malformed `http:`/`https:` link values;
- image/video/audio content without attachment metadata;
- attachment content whose MIME family does not match the selected type.

Return `{ valid: false, errors }`; never throw for ordinary user validation failures.

- [ ] **Step 6: Run focused tests and make GREEN**

Run:

```bash
npm run test:unit -- --run tests/unit/connect-publication.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/connect tests/unit/connect-publication.test.ts
git commit -m "feat(connect): add publication domain contracts"
```

---

### Task 2: Destination registry and permission boundary

**Files:**
- Create: `packages/connect/destinations.ts`
- Create: `packages/connect/permissions.ts`
- Modify: `tests/unit/connect-publication.test.ts`

**Interfaces:**
- Consumes domain types from Task 1.
- Produces `ATLAS_NEWS_WHATSAPP_CHANNEL`, `listPublishDestinations()`, `getPublishDestination(id)`.
- Produces `PermissionAdapter`, `createDevelopmentPermissionAdapter()`, `requirePermission(adapter, permission)`.

- [ ] **Step 1: Add failing registry and permission tests**

Append:

```ts
import { ATLAS_NEWS_WHATSAPP_CHANNEL, getPublishDestination } from '../../packages/connect/destinations';
import { createDevelopmentPermissionAdapter, requirePermission } from '../../packages/connect/permissions';

it('registers the official channel as manual handoff only', () => {
  expect(ATLAS_NEWS_WHATSAPP_CHANNEL.publicUrl).toBe('https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32');
  expect(ATLAS_NEWS_WHATSAPP_CHANNEL.capability).toBe('manual_handoff');
  expect(ATLAS_NEWS_WHATSAPP_CHANNEL.provider).toBe('none_verified_for_channel_publish');
  expect(getPublishDestination(ATLAS_NEWS_WHATSAPP_CHANNEL.id)).toEqual(ATLAS_NEWS_WHATSAPP_CHANNEL);
});

it('fails closed for automated publication permissions in development mode', () => {
  const permissions = createDevelopmentPermissionAdapter();
  expect(permissions.has('connect.publish.request')).toBe(true);
  expect(() => requirePermission({ has: () => false }, 'connect.publish.request')).toThrow(/permission denied/i);
});
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm run test:unit -- --run tests/unit/connect-publication.test.ts
```

Expected: FAIL because registry and permission files do not exist.

- [ ] **Step 3: Implement destination registry**

Create:

```ts
export const ATLAS_NEWS_WHATSAPP_CHANNEL: PublishDestination = {
  id: 'whatsapp-channel-atlas-news',
  platform: 'whatsapp_channel',
  name: 'Atlas Enterprise Suite News',
  capability: 'manual_handoff',
  publicUrl: 'https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32',
  provider: 'none_verified_for_channel_publish',
  supportedContentTypes: ['text', 'link', 'image', 'video']
};

const destinations = [ATLAS_NEWS_WHATSAPP_CHANNEL] as const;
export const listPublishDestinations = () => [...destinations];
export const getPublishDestination = (id: string) => destinations.find((item) => item.id === id) ?? null;
```

Audio and polls remain absent from `supportedContentTypes` in this slice because there is no authoring UI for them yet.

- [ ] **Step 4: Implement permission interface**

Use:

```ts
export interface PermissionAdapter {
  has(permission: AtlasPermission): boolean;
}

const devAllowed = new Set<AtlasPermission>([
  'studio.draft.create',
  'studio.draft.edit',
  'connect.destination.read',
  'connect.publish.request',
  'connect.publish.confirm_manual',
  'connect.publish.retry',
  'connect.audit.read'
]);

export function createDevelopmentPermissionAdapter(): PermissionAdapter {
  return { has: (permission) => devAllowed.has(permission) };
}

export function requirePermission(adapter: PermissionAdapter, permission: AtlasPermission): void {
  if (!adapter.has(permission)) throw new Error(`Permission denied: ${permission}`);
}
```

This grants only the local manual flow; it does not create a server authorization claim.

- [ ] **Step 5: Run tests and commit**

```bash
npm run test:unit -- --run tests/unit/connect-publication.test.ts
npm run typecheck
git add packages/connect tests/unit/connect-publication.test.ts
git commit -m "feat(connect): register WhatsApp Channel capability"
```

---

### Task 3: Versioned development storage and publication service

**Files:**
- Create: `packages/connect/storage.ts`
- Create: `packages/connect/service.ts`
- Create: `tests/unit/connect-storage.test.ts`

**Interfaces:**
- Consumes Task 1/2 contracts.
- Produces `ConnectStore`, `BrowserConnectStore`, `MemoryConnectStore`.
- Produces `createPublicationService({ store, permissions, actor, now })` with `saveDraft`, `markReady`, `startManualHandoff`, `confirmManualPublication`, `listPublications`, `listReceipts`, `listAuditEvents`.

- [ ] **Step 1: Write failing storage/service tests**

Create tests proving exact semantics:

```ts
import { describe, expect, it } from 'vitest';
import { createDevelopmentPermissionAdapter } from '../../packages/connect/permissions';
import { MemoryConnectStore } from '../../packages/connect/storage';
import { createPublicationService } from '../../packages/connect/service';
import { ATLAS_NEWS_WHATSAPP_CHANNEL } from '../../packages/connect/destinations';

const now = () => '2026-09-06T20:45:00-04:00';

describe('ATLAS Connect persistence and service', () => {
  it('does not mark a handoff as published until explicit confirmation', () => {
    const store = new MemoryConnectStore();
    const service = createPublicationService({ store, permissions: createDevelopmentPermissionAdapter(), actor: 'development-user', now });
    const saved = service.saveDraft({
      title: 'News', body: 'Update', link: null, contentType: 'text', attachment: null,
      destinationId: ATLAS_NEWS_WHATSAPP_CHANNEL.id
    });
    const ready = service.markReady(saved.id);
    const handoff = service.startManualHandoff(ready.id);
    expect(handoff.status).toBe('awaiting_manual_publish');
    expect(service.listReceipts()).toHaveLength(0);
    const published = service.confirmManualPublication(handoff.id, 'wa-update-reference');
    expect(published.status).toBe('published');
    expect(service.listReceipts()[0].verification).toBe('manual_confirmation');
  });

  it('records handoff_started separately from manual_publish_confirmed', () => {
    const store = new MemoryConnectStore();
    const service = createPublicationService({ store, permissions: createDevelopmentPermissionAdapter(), actor: 'development-user', now });
    const draft = service.saveDraft({ title: 'A', body: 'B', link: null, contentType: 'text', attachment: null, destinationId: ATLAS_NEWS_WHATSAPP_CHANNEL.id });
    service.startManualHandoff(service.markReady(draft.id).id);
    expect(service.listAuditEvents().map((event) => event.action)).toContain('handoff_started');
    expect(service.listAuditEvents().map((event) => event.action)).not.toContain('manual_publish_confirmed');
  });
});
```

- [ ] **Step 2: Run test and verify RED**

```bash
npm run test:unit -- --run tests/unit/connect-storage.test.ts
```

Expected: FAIL because storage/service files are missing.

- [ ] **Step 3: Implement `ConnectStore` and memory adapter**

Use one versioned state envelope:

```ts
export interface ConnectStoreState {
  schemaVersion: 1;
  drafts: PublishDraft[];
  receipts: PublicationReceipt[];
  auditEvents: PublicationAuditEvent[];
}

export interface ConnectStore {
  read(): ConnectStoreState;
  write(state: ConnectStoreState): void;
}
```

`MemoryConnectStore` clones state on read/write to prevent accidental mutation.

- [ ] **Step 4: Implement browser adapter with secret-key rejection**

`BrowserConnectStore` uses key `atlas.connect.dev.v1`. Before write, recursively reject object keys matching this case-insensitive expression:

```ts
/(token|password|cookie|secret|session|authorization|credential)/i
```

Throw `Error('Sensitive material is not allowed in ATLAS Connect development storage')` when found. Parsing invalid/mismatched schema data must return an empty schema-v1 state rather than crash the app.

- [ ] **Step 5: Implement publication service**

Rules:
- `saveDraft` creates `draft-<timestamp>-<counter>` and `draft_saved` audit.
- `markReady` validates against the registry, computes fingerprint, transitions to `ready`, writes `marked_ready` audit.
- `startManualHandoff` requires destination `manual_handoff`, transitions only `ready -> awaiting_manual_publish`, writes `handoff_started`; it returns the draft and the caller/UI opens `destination.publicUrl`.
- `confirmManualPublication` requires `connect.publish.confirm_manual`, transitions only `awaiting_manual_publish -> published`, creates a receipt with `manual_confirmation`, writes `manual_publish_confirmed`.
- A receipt fingerprint must equal the fingerprint stored when the draft became ready.
- Any provider-publish method in this slice must throw `Error('Automated provider publishing is not configured')`.

- [ ] **Step 6: Run unit suite and commit**

```bash
npm run test:unit -- --run tests/unit/connect-storage.test.ts tests/unit/connect-publication.test.ts
npm run typecheck
git add packages/connect tests/unit/connect-storage.test.ts
git commit -m "feat(connect): add local publication repository and audit service"
```

---

### Task 4: Creator Studio and ATLAS Connect routes

**Files:**
- Create: `apps/web/src/modules/studio/StudioHome.tsx`
- Create: `apps/web/src/modules/studio/PublishPage.tsx`
- Create: `apps/web/src/modules/connect/ConnectHome.tsx`
- Create: `apps/web/src/modules/connect/DestinationsPage.tsx`
- Create: `apps/web/src/modules/connect/WhatsAppChannelPage.tsx`
- Create: `apps/web/src/modules/connect/PublicationsPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Create: `tests/integration/connect-publish-flow.test.tsx`

**Interfaces:**
- UI consumes `BrowserConnectStore`, `createPublicationService`, and destination registry.
- No UI component imports Peach or Meta-specific APIs.

- [ ] **Step 1: Add failing route tests**

Create:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';

beforeEach(() => localStorage.clear());

describe('Creator Studio and ATLAS Connect routes', () => {
  it('renders the WhatsApp Channel destination truthfully', () => {
    render(<MemoryRouter initialEntries={['/connect/destinations/whatsapp-channel']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Atlas Enterprise Suite News' })).toBeInTheDocument();
    expect(screen.getByText(/manual handoff/i)).toBeInTheDocument();
    expect(screen.getByText(/not automated/i)).toBeInTheDocument();
  });

  it('does not show publication success after merely opening the channel', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<MemoryRouter initialEntries={['/studio/publish']}><App /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Post text'), { target: { value: 'ATLAS update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark ready' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open WhatsApp Channel to publish' }));
    expect(open).toHaveBeenCalledWith('https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32', '_blank', 'noopener,noreferrer');
    expect(screen.getByText(/awaiting manual confirmation/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Published$/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run integration test and verify RED**

```bash
npm run test:integration -- --run tests/integration/connect-publish-flow.test.tsx
```

Expected: FAIL because routes/components do not exist.

- [ ] **Step 3: Implement route pages with focused responsibilities**

`StudioHome.tsx`: heading `Creator Studio`, card linking to `/studio/publish`.

`ConnectHome.tsx`: heading `ATLAS Connect`, cards linking to `/connect/destinations` and `/connect/publications`.

`DestinationsPage.tsx`: list registry destinations; capability badge text exactly `Manual handoff` for the Channel.

`WhatsAppChannelPage.tsx`: show name, public URL, supported types, provider text `No verified Channel publishing provider`, and notice `Not automated — opening WhatsApp is not publication evidence.`

`PublicationsPage.tsx`: read local store and render empty state or publication/receipt rows with verification type.

- [ ] **Step 4: Implement `PublishPage.tsx` state flow**

Required controls and labels:
- `Internal title`
- `Post text`
- `Link`
- content type select with `text`, `link`, `image`, `video`
- `Save draft`
- `Mark ready`
- `Open WhatsApp Channel to publish`
- `I published this update`
- optional `WhatsApp update reference`

The page creates one service instance via `useMemo`. It reloads the persisted current draft after each service mutation. It displays the exact environment banner: `Development local persistence — not tenant-safe production storage`.

`Open WhatsApp Channel to publish` must call the service first, then:

```ts
window.open(destination.publicUrl, '_blank', 'noopener,noreferrer');
```

After that action display `Awaiting manual confirmation` and expose `I published this update`. Only that confirmation creates a published receipt.

- [ ] **Step 5: Wire routes and shell navigation**

Add to `AtlasShell.tsx`:

```ts
{ to: '/studio', label: 'Creator Studio' },
{ to: '/connect', label: 'Connect' }
```

Add to `App.tsx`:

```tsx
<Route path="/studio" element={<StudioHome />} />
<Route path="/studio/publish" element={<PublishPage />} />
<Route path="/connect" element={<ConnectHome />} />
<Route path="/connect/destinations" element={<DestinationsPage />} />
<Route path="/connect/destinations/whatsapp-channel" element={<WhatsAppChannelPage />} />
<Route path="/connect/publications" element={<PublicationsPage />} />
```

Update `EnterpriseHome` with enabled cards for Creator Studio and ATLAS Connect only after these routes exist in the same commit.

- [ ] **Step 6: Run route tests and commit**

```bash
npm run test:integration -- --run tests/integration/connect-publish-flow.test.tsx tests/integration/payables-route.test.tsx tests/integration/health-routes.test.tsx
npm run typecheck
git add apps/web/src apps/web/src/components tests/integration/connect-publish-flow.test.tsx
git commit -m "feat(studio): add WhatsApp Channel manual publish flow"
```

---

### Task 5: Responsive UI states and error handling

**Files:**
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/modules/studio/PublishPage.tsx`
- Modify: `apps/web/src/modules/connect/DestinationsPage.tsx`
- Modify: `apps/web/src/modules/connect/WhatsAppChannelPage.tsx`
- Modify: `apps/web/src/modules/connect/PublicationsPage.tsx`
- Modify: `tests/integration/connect-publish-flow.test.tsx`

**Interfaces:**
- No new domain interfaces.
- UI must expose disabled/error/success/empty states without changing core state semantics.

- [ ] **Step 1: Add failing visible-state tests**

Add assertions that:
- empty text/link content renders validation errors after `Mark ready`;
- handoff button is disabled until status `ready`;
- confirmation button exists only in `awaiting_manual_publish`;
- publications page shows `No publication receipts yet` with empty storage;
- destination page shows `Manual handoff` and not `Connected`.

Example:

```tsx
it('fails validation without promoting the draft', () => {
  render(<MemoryRouter initialEntries={['/studio/publish']}><App /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mark ready' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/content is required/i);
  expect(screen.queryByText(/^Ready$/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run integration test and verify RED where state copy/disable behavior is missing**

```bash
npm run test:integration -- --run tests/integration/connect-publish-flow.test.tsx
```

- [ ] **Step 3: Implement responsive layout**

Add classes using the existing stylesheet conventions:
- `.publish-layout` two columns at desktop, one column under `900px`;
- `.publish-form`, `.publish-preview`, `.destination-card`, `.capability-banner`, `.receipt-list`, `.audit-list`;
- form controls use existing ATLAS borders/radii/spacing variables or nearest existing declarations;
- buttons expose `:disabled`, `:focus-visible`, and hover states;
- never hide provider truth notices on mobile.

- [ ] **Step 4: Implement explicit validation/error/success status region**

Use one `role="status"` for non-error workflow state and one `role="alert"` only for validation/action failures. Do not report `Published` until service state is actually `published`.

- [ ] **Step 5: Run focused and regression tests; commit**

```bash
npm run test:integration -- --run tests/integration/connect-publish-flow.test.tsx
npm run test:unit -- --run tests/unit/connect-publication.test.ts tests/unit/connect-storage.test.ts
npm run typecheck
git add apps/web/src tests/integration/connect-publish-flow.test.tsx
git commit -m "feat(connect): harden responsive publish states"
```

---

### Task 6: Full verification, CI review, and PR readiness

**Files:**
- Modify only files required to fix failures discovered by the gates.
- Update: PR #36 title/body from design-only wording to implementation summary after all gates pass.

**Interfaces:**
- Verification consumes the completed implementation only.
- No new product scope is allowed in this task.

- [ ] **Step 1: Run all local repository gates**

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Inspect diff for forbidden material**

Run:

```bash
git diff main...HEAD --check
git grep -nEi '(whatsapp.*(token|cookie|session|password|secret)|authorization: bearer|access[_-]?token)' -- ':!package-lock.json'
```

Expected: `git diff --check` exits 0; secret scan returns no credential material.

- [ ] **Step 3: Verify branch scope**

Run:

```bash
git diff --name-only main...HEAD
```

Expected files are limited to the approved spec/plan, `packages/connect`, focused Studio/Connect web modules, shared routing/shell/styles, and tests. Investigate any unrelated file before continuing.

- [ ] **Step 4: Update PR #36 description**

Use this factual structure:

```markdown
## Summary
- adds provider-neutral ATLAS Connect publication contracts and local development repository
- registers Atlas Enterprise Suite News as a truthful `manual_handoff` WhatsApp Channel destination
- adds Creator Studio compose/review/handoff/confirmation UX
- separates `handoff_started` from `published` and records manual-confirmation receipts/audit
- adds route, unit, integration, typecheck, build, and security-boundary coverage

## Truth boundary
Automated WhatsApp Channel publishing is not claimed. Peach currently remains a WhatsApp Business messaging integration, not a verified Channel publisher.

## Verification
- npm run typecheck
- npm run test:unit
- npm run test:integration
- npm test
- npm run build
```

- [ ] **Step 5: Let PR-triggered `ATLAS Consensus CI` run**

Expected checks from `.github/workflows/atlas-consensus-ci.yml`:
- `Opinion 1 - Product and UX`
- `Opinion 2 - Architecture and Build`
- `Opinion 3 - Security and Reliability`
- `ATLAS 3-of-3 Consensus`

Do not mark ready or merge while any required check is pending or failing.

- [ ] **Step 6: Review CI failures by exact head SHA and repair on the feature branch**

For every failure, inspect logs, make the smallest relevant correction, rerun affected tests, commit, and require fresh exact-head CI.

- [ ] **Step 7: Mark PR ready only after unanimous green evidence**

Before readiness, confirm:
- Channel still says `manual_handoff`;
- no `connected/live/automated` false claim exists;
- opening WhatsApp does not create receipt;
- explicit confirmation creates `manual_confirmation` receipt;
- Finance and Health regressions remain green.

- [ ] **Step 8: Merge only if repository review policy and all checks permit it**

Use the repository-supported merge method. Do not force-update `main`.

- [ ] **Step 9: Treat deployment and runtime verification as separate gates**

After merge, production deployment must be checked through the canonical ATLAS Manager chain. A successful merge is not evidence that `/studio` or `/connect` is live at `www.atlasenterprisesuite.com`.

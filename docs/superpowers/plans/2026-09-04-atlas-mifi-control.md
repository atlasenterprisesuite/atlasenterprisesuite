# ATLAS MiFi Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first safe ATLAS Telecom MiFi control slice with call-forwarding validation, a truthful unavailable adapter, responsive UI, route/navigation integration, and a documented hardware-bridge contract.

**Architecture:** Keep modem-independent logic in a new `packages/telecom` TypeScript package and reuse `TenantScope`/`sameScope()` from `packages/core`. The React UI consumes the `MifiAdapter` interface only; the default adapter explicitly reports unavailable and cannot fabricate carrier success. A later hardware-specific bridge will implement the same adapter after the actual MiFi make/model and modem transport are identified.

**Tech Stack:** TypeScript 5.7, React 18, React Router, Vite 6, Vitest 3, Testing Library, existing ATLAS CSS shell.

**Spec:** `docs/superpowers/specs/2026-09-04-atlas-mifi-control-design.md`

## Global Constraints

- Reuse `TenantScope` and `sameScope()` from `packages/core/src/index.ts`; do not create a second tenancy model.
- Never hard-code the user's MiFi line or forwarding destination in source.
- Never display `Connected`, `Verified`, `Live`, or carrier-confirmed state unless a real adapter returns that state.
- The default repository adapter is unavailable and must reject network writes.
- Browser code never issues raw AT, QMI, MBIM, USSD, or manufacturer modem commands.
- Network write controls remain disabled while the adapter/capability is unavailable.
- Firmware flashing is outside this implementation slice.
- All repository gates must pass before merge: `npm test`, `npm run typecheck`, `npm run build`.

---

### Task 1: Telecom domain package and call-forwarding validation

**Files:**
- Create: `packages/telecom/package.json`
- Create: `packages/telecom/src/types.ts`
- Create: `packages/telecom/src/errors.ts`
- Create: `packages/telecom/src/validation.ts`
- Create: `packages/telecom/src/index.ts`
- Modify: `package-lock.json`
- Create: `tests/unit/telecom-mifi.test.ts`

**Interfaces:**
- Consumes: `TenantScope` and `sameScope(a, b)` from `packages/core/src/index.ts`.
- Produces: `ForwardingReason`, `ModemCapabilities`, `MifiDevice`, `CallForwardingRule`, `CallForwardingRequest`, `CallForwardingResult`, `TelecomError`, `normalizeNanpE164()`, and `validateForwardingRequest()`.

- [ ] **Step 1: Write failing unit tests for E.164 normalization and validation**

Create `tests/unit/telecom-mifi.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  normalizeNanpE164,
  validateForwardingRequest,
  TelecomError,
  type MifiDevice
} from '../../packages/telecom/src';

const scope = { tenantId: 'tenant-demo', organizationId: 'org-demo' };
const device: MifiDevice = {
  id: 'mifi-1',
  scope,
  displayName: 'Primary MiFi',
  carrierName: null,
  lineNumber: null,
  connectionState: 'connected',
  capabilities: {
    callForwarding: true,
    callForwardingReasons: ['all', 'busy', 'no-answer', 'not-reachable'],
    sms: false,
    ussd: false,
    atCommands: false,
    qmi: false,
    mbim: false
  }
};

describe('ATLAS Telecom MiFi domain', () => {
  it('normalizes US NANP inputs to E.164', () => {
    expect(normalizeNanpE164('786 555 0123')).toBe('+17865550123');
    expect(normalizeNanpE164('1-786-555-0123')).toBe('+17865550123');
    expect(normalizeNanpE164('+1 (786) 555-0123')).toBe('+17865550123');
  });

  it('rejects malformed destinations', () => {
    expect(() => normalizeNanpE164('555')).toThrowError(TelecomError);
  });

  it('accepts a supported forwarding request in the same tenant scope', () => {
    expect(validateForwardingRequest(device, {
      deviceId: device.id,
      scope,
      rule: { enabled: true, reason: 'all', destinationE164: '+17865550123' }
    }).rule.destinationE164).toBe('+17865550123');
  });

  it('rejects a forwarding reason the modem does not support', () => {
    const limited: MifiDevice = {
      ...device,
      capabilities: { ...device.capabilities, callForwardingReasons: ['all'] }
    };
    expect(() => validateForwardingRequest(limited, {
      deviceId: device.id,
      scope,
      rule: { enabled: true, reason: 'busy', destinationE164: '+17865550123' }
    })).toThrowError('CAPABILITY_UNSUPPORTED');
  });

  it('rejects no-answer seconds outside the allowed range', () => {
    expect(() => validateForwardingRequest(device, {
      deviceId: device.id,
      scope,
      rule: { enabled: true, reason: 'no-answer', destinationE164: '+17865550123', noAnswerSeconds: 31 }
    })).toThrowError('INVALID_DESTINATION');
  });

  it('rejects a tenant scope mismatch', () => {
    expect(() => validateForwardingRequest(device, {
      deviceId: device.id,
      scope: { tenantId: 'tenant-other', organizationId: 'org-other' },
      rule: { enabled: true, reason: 'all', destinationE164: '+17865550123' }
    })).toThrowError('SCOPE_MISMATCH');
  });
});
```

- [ ] **Step 2: Run the unit test and verify it fails because the Telecom package does not exist**

Run:

```bash
npx vitest run tests/unit/telecom-mifi.test.ts
```

Expected: FAIL with module resolution errors for `../../packages/telecom/src`.

- [ ] **Step 3: Create the Telecom package skeleton and public domain types**

`packages/telecom/package.json`:

```json
{
  "name": "@atlas/telecom",
  "private": true,
  "version": "0.1.0",
  "type": "module"
}
```

`packages/telecom/src/types.ts`:

```ts
import type { TenantScope } from '../../core/src';

export type ForwardingReason = 'all' | 'busy' | 'no-answer' | 'not-reachable';
export type DeviceConnectionState = 'unavailable' | 'discovering' | 'connected' | 'error';
export type OperationState = 'idle' | 'submitting' | 'verified' | 'failed';
export type TelecomPermission = 'telecom.mifi.read' | 'telecom.mifi.forwarding.write';

export interface ModemCapabilities {
  callForwarding: boolean;
  callForwardingReasons: ForwardingReason[];
  sms: boolean;
  ussd: boolean;
  atCommands: boolean;
  qmi: boolean;
  mbim: boolean;
}

export interface MifiDevice {
  id: string;
  scope: TenantScope;
  displayName: string;
  carrierName: string | null;
  lineNumber: string | null;
  connectionState: DeviceConnectionState;
  capabilities: ModemCapabilities;
}

export interface CallForwardingRule {
  enabled: boolean;
  reason: ForwardingReason;
  destinationE164: string;
  noAnswerSeconds?: number;
}

export interface CallForwardingRequest {
  deviceId: string;
  scope: TenantScope;
  rule: CallForwardingRule;
}

export interface CallForwardingResult {
  requestId: string;
  accepted: boolean;
  verified: boolean;
  networkMessage: string | null;
  errorCode: string | null;
}
```

- [ ] **Step 4: Implement typed errors and validation**

`packages/telecom/src/errors.ts`:

```ts
export type TelecomErrorCode =
  | 'ADAPTER_UNAVAILABLE'
  | 'DEVICE_NOT_FOUND'
  | 'CAPABILITY_UNSUPPORTED'
  | 'INVALID_DESTINATION'
  | 'SCOPE_MISMATCH'
  | 'NETWORK_REJECTED'
  | 'VERIFICATION_MISMATCH';

export class TelecomError extends Error {
  constructor(public readonly code: TelecomErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'TelecomError';
  }
}
```

`packages/telecom/src/validation.ts`:

```ts
import { sameScope } from '../../core/src';
import { TelecomError } from './errors';
import type { CallForwardingRequest, MifiDevice } from './types';

export function normalizeNanpE164(input: string) {
  const compact = input.trim().replace(/[\s().-]/g, '');
  if (/^\+1\d{10}$/.test(compact)) return compact;
  if (/^1\d{10}$/.test(compact)) return `+${compact}`;
  if (/^\d{10}$/.test(compact)) return `+1${compact}`;
  throw new TelecomError('INVALID_DESTINATION', 'Enter a valid 10-digit US/Canada number.');
}

export function validateForwardingRequest(device: MifiDevice, request: CallForwardingRequest) {
  if (!sameScope(device.scope, request.scope)) {
    throw new TelecomError('SCOPE_MISMATCH', 'Device and request must belong to the active ATLAS scope.');
  }
  if (device.id !== request.deviceId) {
    throw new TelecomError('DEVICE_NOT_FOUND', 'The selected MiFi does not match this request.');
  }
  if (!device.capabilities.callForwarding || !device.capabilities.callForwardingReasons.includes(request.rule.reason)) {
    throw new TelecomError('CAPABILITY_UNSUPPORTED', 'This MiFi does not report support for the requested forwarding mode.');
  }
  const destinationE164 = normalizeNanpE164(request.rule.destinationE164);
  if (request.rule.reason === 'no-answer') {
    const seconds = request.rule.noAnswerSeconds;
    if (!Number.isInteger(seconds) || seconds! < 5 || seconds! > 30) {
      throw new TelecomError('INVALID_DESTINATION', 'No-answer delay must be an integer from 5 through 30 seconds.');
    }
  }
  return { ...request, rule: { ...request.rule, destinationE164 } };
}
```

`packages/telecom/src/index.ts`:

```ts
export * from './types';
export * from './errors';
export * from './validation';
```

- [ ] **Step 5: Refresh the workspace lockfile without adding dependencies**

Run:

```bash
npm install --package-lock-only --ignore-scripts
```

Expected: `package-lock.json` contains the new `packages/telecom` workspace entry and no unrelated dependency upgrade is introduced.

- [ ] **Step 6: Run the Telecom unit tests**

Run:

```bash
npx vitest run tests/unit/telecom-mifi.test.ts
```

Expected: PASS for normalization, capability, delay, and scope tests.

- [ ] **Step 7: Commit the domain package**

```bash
git add packages/telecom package-lock.json tests/unit/telecom-mifi.test.ts
git commit -m "feat: add telecom MiFi domain"
```

---

### Task 2: Unavailable device adapter and truthful verification rules

**Files:**
- Create: `packages/telecom/src/adapter.ts`
- Modify: `packages/telecom/src/index.ts`
- Modify: `tests/unit/telecom-mifi.test.ts`

**Interfaces:**
- Consumes: Task 1 domain types and `TenantScope`.
- Produces: `MifiAdapter`, `UnavailableMifiAdapter`, `rulesMatch()`.

- [ ] **Step 1: Add failing tests for adapter safety and verification matching**

Append these tests inside the existing Telecom `describe` block and add `UnavailableMifiAdapter` plus `rulesMatch` to the current package import:

```ts
it('unavailable adapter never accepts a forwarding write', async () => {
  const adapter = new UnavailableMifiAdapter();
  await expect(adapter.setCallForwarding({
    deviceId: 'mifi-1',
    scope,
    rule: { enabled: true, reason: 'all', destinationE164: '+17865550123' }
  })).rejects.toThrow('ADAPTER_UNAVAILABLE');
});

it('marks verification as matching only when the network rule matches', () => {
  const expected = { enabled: true, reason: 'all' as const, destinationE164: '+17865550123' };
  expect(rulesMatch(expected, [{ ...expected }])).toBe(true);
  expect(rulesMatch(expected, [{ ...expected, destinationE164: '+14075550123' }])).toBe(false);
});
```

- [ ] **Step 2: Run the focused tests and verify missing exports fail**

Run:

```bash
npx vitest run tests/unit/telecom-mifi.test.ts
```

Expected: FAIL because `UnavailableMifiAdapter` and `rulesMatch` do not exist.

- [ ] **Step 3: Implement the adapter contract and unavailable adapter**

`packages/telecom/src/adapter.ts`:

```ts
import type { TenantScope } from '../../core/src';
import { TelecomError } from './errors';
import type {
  CallForwardingRequest,
  CallForwardingResult,
  CallForwardingRule,
  MifiDevice,
  ModemCapabilities
} from './types';

export interface MifiAdapter {
  getDevice(deviceId: string, scope: TenantScope): Promise<MifiDevice>;
  getCallForwarding(deviceId: string, scope: TenantScope): Promise<CallForwardingRule[]>;
  setCallForwarding(request: CallForwardingRequest): Promise<CallForwardingResult>;
  verifyCallForwarding(deviceId: string, scope: TenantScope): Promise<CallForwardingRule[]>;
}

const noCapabilities: ModemCapabilities = {
  callForwarding: false,
  callForwardingReasons: [],
  sms: false,
  ussd: false,
  atCommands: false,
  qmi: false,
  mbim: false
};

export class UnavailableMifiAdapter implements MifiAdapter {
  async getDevice(deviceId: string, scope: TenantScope): Promise<MifiDevice> {
    return {
      id: deviceId,
      scope,
      displayName: 'MiFi device',
      carrierName: null,
      lineNumber: null,
      connectionState: 'unavailable',
      capabilities: { ...noCapabilities, callForwardingReasons: [] }
    };
  }

  async getCallForwarding(_deviceId: string, _scope: TenantScope): Promise<CallForwardingRule[]> {
    return [];
  }

  async setCallForwarding(_request: CallForwardingRequest): Promise<CallForwardingResult> {
    throw new TelecomError('ADAPTER_UNAVAILABLE', 'No authorized MiFi device adapter is connected.');
  }

  async verifyCallForwarding(_deviceId: string, _scope: TenantScope): Promise<CallForwardingRule[]> {
    throw new TelecomError('ADAPTER_UNAVAILABLE', 'No authorized MiFi device adapter is connected.');
  }
}

export function rulesMatch(expected: CallForwardingRule, actual: CallForwardingRule[]) {
  return actual.some((rule) =>
    rule.enabled === expected.enabled &&
    rule.reason === expected.reason &&
    rule.destinationE164 === expected.destinationE164 &&
    rule.noAnswerSeconds === expected.noAnswerSeconds
  );
}
```

Update `packages/telecom/src/index.ts`:

```ts
export * from './types';
export * from './errors';
export * from './validation';
export * from './adapter';
```

- [ ] **Step 4: Run the Telecom unit tests**

Run:

```bash
npx vitest run tests/unit/telecom-mifi.test.ts
```

Expected: PASS, including the rejection of all writes by the unavailable adapter.

- [ ] **Step 5: Commit the adapter boundary**

```bash
git add packages/telecom/src tests/unit/telecom-mifi.test.ts
git commit -m "feat: add safe MiFi adapter boundary"
```

---

### Task 3: MiFi control page, route, and global navigation

**Files:**
- Create: `apps/web/src/modules/telecom/MifiControlPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/AtlasShell.tsx`
- Create: `tests/integration/mifi-route.test.tsx`

**Interfaces:**
- Consumes: `demoAtlasContext.scope`, `UnavailableMifiAdapter`, `normalizeNanpE164`, `ForwardingReason`.
- Produces: route `/telecom/devices/mifi` with configuration, capability, and forwarding controls that remain safely disabled without a real adapter.

- [ ] **Step 1: Write the failing route integration test**

Create `tests/integration/mifi-route.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('ATLAS Telecom MiFi route', () => {
  it('renders MiFi controls inside the shared ATLAS shell without false live state', async () => {
    render(<MemoryRouter initialEntries={['/telecom/devices/mifi']}><App /></MemoryRouter>);

    expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Telecom' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'MiFi Control' })).toBeInTheDocument();
    expect(screen.getByText(/No authorized MiFi device adapter is connected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate forwarding' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Verify forwarding' })).toBeDisabled();
    expect(screen.queryByText(/^Connected$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Verified$/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the integration test and verify the route does not exist**

Run:

```bash
npx vitest run tests/integration/mifi-route.test.tsx
```

Expected: FAIL because the Telecom route and navigation item are missing.

- [ ] **Step 3: Create the MiFi control page**

Create `apps/web/src/modules/telecom/MifiControlPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { demoAtlasContext } from '../../../../../packages/core/src';
import {
  UnavailableMifiAdapter,
  normalizeNanpE164,
  type ForwardingReason,
  type MifiDevice
} from '../../../../../packages/telecom/src';

const adapter = new UnavailableMifiAdapter();
const deviceId = 'primary-mifi';
const unavailableNotice = 'No authorized MiFi device adapter is connected. ATLAS will not report carrier state until a real modem confirms it.';

export function MifiControlPage() {
  const [device, setDevice] = useState<MifiDevice | null>(null);
  const [displayName, setDisplayName] = useState('Primary MiFi');
  const [carrierName, setCarrierName] = useState('');
  const [lineNumber, setLineNumber] = useState('');
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState<ForwardingReason>('all');
  const [noAnswerSeconds, setNoAnswerSeconds] = useState(20);
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    adapter.getDevice(deviceId, demoAtlasContext.scope).then(setDevice);
  }, []);

  const canWrite = Boolean(device?.connectionState === 'connected' && device.capabilities.callForwarding);
  const capabilityEntries = useMemo(() => device ? [
    ['Call Forwarding', device.capabilities.callForwarding],
    ['SMS', device.capabilities.sms],
    ['USSD', device.capabilities.ussd],
    ['AT Commands', device.capabilities.atCommands],
    ['QMI', device.capabilities.qmi],
    ['MBIM', device.capabilities.mbim]
  ] as const : [], [device]);

  function validateDestination() {
    if (!destination.trim()) {
      setValidationMessage('Enter the destination number before activation.');
      return;
    }
    try {
      normalizeNanpE164(destination);
      setValidationMessage('');
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : 'Invalid destination number.');
    }
  }

  return (
    <div className="page-stack mifi-page">
      <header className="page-header">
        <p className="eyebrow">Telecom / Devices / MiFi</p>
        <h1>MiFi Control</h1>
        <p>Configure the device locally and expose network controls only after an authorized modem adapter confirms support.</p>
      </header>

      <div className="notice strong" role="status">{unavailableNotice}</div>

      <section className="workspace-card mifi-config-card" aria-labelledby="mifi-device-heading">
        <div><p className="eyebrow">Device</p><h2 id="mifi-device-heading">Configuration</h2></div>
        <div className="mifi-form-grid">
          <label className="field"><span>Device name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label className="field"><span>Carrier</span><input value={carrierName} onChange={(event) => setCarrierName(event.target.value)} placeholder="Carrier label" /></label>
          <label className="field"><span>MiFi line</span><input value={lineNumber} onChange={(event) => setLineNumber(event.target.value)} inputMode="tel" placeholder="Phone number" /></label>
        </div>
        <div className="connection-gate"><strong>Adapter state</strong><span>{device?.connectionState ?? 'discovering'}</span></div>
      </section>

      <section className="workspace-card" aria-labelledby="mifi-capabilities-heading">
        <div><p className="eyebrow">Capabilities</p><h2 id="mifi-capabilities-heading">Modem controls</h2></div>
        <div className="capability-grid">
          {capabilityEntries.map(([label, supported]) => <article key={label}><span>{label}</span><strong>{supported ? 'Supported' : 'Unavailable'}</strong></article>)}
        </div>
      </section>

      <section className="workspace-card" aria-labelledby="mifi-forwarding-heading">
        <div><p className="eyebrow">Voice</p><h2 id="mifi-forwarding-heading">Call Forwarding</h2></div>
        <div className="mifi-form-grid">
          <label className="field"><span>Forward calls to</span><input value={destination} onChange={(event) => setDestination(event.target.value)} onBlur={validateDestination} inputMode="tel" aria-describedby="destination-message" /></label>
          <label className="field"><span>Forwarding mode</span><select value={reason} onChange={(event) => setReason(event.target.value as ForwardingReason)}><option value="all">All calls</option><option value="busy">When busy</option><option value="no-answer">No answer</option><option value="not-reachable">Not reachable</option></select></label>
          {reason === 'no-answer' && <label className="field"><span>No-answer delay</span><input type="number" min={5} max={30} value={noAnswerSeconds} onChange={(event) => setNoAnswerSeconds(Number(event.target.value))} /></label>}
        </div>
        <p id="destination-message" className="field-message" aria-live="polite">{validationMessage}</p>
        <div className="mifi-actions">
          <button disabled={!canWrite} onClick={validateDestination}>Activate forwarding</button>
          <button disabled={!canWrite}>Verify forwarding</button>
          <button disabled={!canWrite}>Disable forwarding</button>
        </div>
      </section>
    </div>
  );
}
```

The local configuration inputs intentionally do not persist a network rule. The buttons remain disabled because the only repository adapter is unavailable.

- [ ] **Step 4: Register the route and navigation item**

In `apps/web/src/App.tsx` add:

```tsx
import { MifiControlPage } from './modules/telecom/MifiControlPage';
```

Add an Enterprise card:

```tsx
<Link className="module-card enabled" to="/telecom/devices/mifi"><span>Communications</span><strong>Telecom</strong><p>MiFi device controls with capability and authorization gates.</p></Link>
```

Add the route:

```tsx
<Route path="/telecom/devices/mifi" element={<MifiControlPage />} />
```

In `apps/web/src/components/AtlasShell.tsx`, add to `navItems`:

```ts
{ to: '/telecom/devices/mifi', label: 'Telecom' }
```

- [ ] **Step 5: Run the route integration test**

Run:

```bash
npx vitest run tests/integration/mifi-route.test.tsx
```

Expected: PASS with disabled write controls and no false live state.

- [ ] **Step 6: Commit the Telecom route**

```bash
git add apps/web/src/modules/telecom apps/web/src/App.tsx apps/web/src/components/AtlasShell.tsx tests/integration/mifi-route.test.tsx
git commit -m "feat: add ATLAS MiFi control route"
```

---

### Task 4: Responsive ATLAS styling and accessible interaction states

**Files:**
- Modify: `apps/web/src/styles.css`
- Modify: `tests/integration/mifi-route.test.tsx`

**Interfaces:**
- Consumes: CSS classes emitted by `MifiControlPage`.
- Produces: responsive form/capability/action layout that uses existing ATLAS visual language and visible disabled/focus/error states.

- [ ] **Step 1: Add integration assertions for labels and disabled controls**

Append inside the existing `describe` block in `tests/integration/mifi-route.test.tsx`:

```tsx
it('exposes accessible MiFi form labels and safe disabled actions', async () => {
  render(<MemoryRouter initialEntries={['/telecom/devices/mifi']}><App /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'MiFi Control' });
  expect(screen.getByLabelText('Device name')).toBeInTheDocument();
  expect(screen.getByLabelText('Carrier')).toBeInTheDocument();
  expect(screen.getByLabelText('MiFi line')).toBeInTheDocument();
  expect(screen.getByLabelText('Forward calls to')).toBeInTheDocument();
  expect(screen.getByLabelText('Forwarding mode')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Disable forwarding' })).toBeDisabled();
});
```

- [ ] **Step 2: Run the test before CSS changes to keep behavior green**

Run:

```bash
npx vitest run tests/integration/mifi-route.test.tsx
```

Expected: PASS; styling changes must not regress semantics.

- [ ] **Step 3: Add focused MiFi styles**

Append to `apps/web/src/styles.css`:

```css
.mifi-page .workspace-card { display: grid; gap: 18px; }
.mifi-form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.capability-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.capability-grid article { border: 1px solid var(--line, rgba(255,255,255,.1)); border-radius: 14px; padding: 14px; display: grid; gap: 6px; }
.capability-grid article span { opacity: .72; font-size: .82rem; }
.mifi-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.mifi-actions button { min-height: 42px; }
.mifi-actions button:disabled { cursor: not-allowed; opacity: .48; }
.field-message { min-height: 1.25rem; margin: 0; font-size: .85rem; }

@media (max-width: 900px) {
  .mifi-form-grid, .capability-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .mifi-form-grid, .capability-grid { grid-template-columns: 1fr; }
  .mifi-actions { display: grid; grid-template-columns: 1fr; }
  .mifi-actions button { width: 100%; }
}
```

If `--line` is not present in the current stylesheet, the fallback remains valid and no new global color token is required.

- [ ] **Step 4: Run integration tests, typecheck, and build**

Run:

```bash
npx vitest run tests/integration/mifi-route.test.tsx
npm run typecheck
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Commit responsive styling**

```bash
git add apps/web/src/styles.css tests/integration/mifi-route.test.tsx
git commit -m "style: make MiFi control responsive"
```

---

### Task 5: Hardware bridge protocol and production truth gate

**Files:**
- Create: `docs/telecom/mifi-bridge-protocol.md`
- Modify: `tests/unit/telecom-mifi.test.ts`

**Interfaces:**
- Consumes: `MifiAdapter` domain contract.
- Produces: a concrete authenticated HTTP contract that a later OpenWrt/ModemManager, manufacturer API, QMI/MBIM, or AT-command bridge can implement without changing the React page.

- [ ] **Step 1: Add a unit test locking the unavailable production-safe default**

Append inside the Telecom `describe` block:

```ts
it('reports no modem capabilities from the repository default adapter', async () => {
  const adapter = new UnavailableMifiAdapter();
  const unavailable = await adapter.getDevice('primary-mifi', scope);
  expect(unavailable.connectionState).toBe('unavailable');
  expect(unavailable.capabilities.callForwarding).toBe(false);
  expect(unavailable.capabilities.callForwardingReasons).toEqual([]);
});
```

- [ ] **Step 2: Run the unit test**

Run:

```bash
npx vitest run tests/unit/telecom-mifi.test.ts
```

Expected: PASS.

- [ ] **Step 3: Document the bridge API exactly**

Create `docs/telecom/mifi-bridge-protocol.md` with this contract:

```md
# ATLAS MiFi Bridge Protocol v1

The bridge is a trusted local/embedded service. Browser clients never receive raw modem credentials or direct modem access.

## Authentication
Every request carries an ATLAS-issued bearer credential over HTTPS or a mutually authenticated local transport. The bridge validates tenant, organization, actor, device permission, expiry, and request idempotency before writes.

## GET /v1/devices/:deviceId
Returns the normalized `MifiDevice` schema defined in `packages/telecom/src/types.ts`. An unavailable bridge returns `connectionState: "unavailable"` and false capabilities; it does not fabricate a connected device.

## GET /v1/devices/:deviceId/call-forwarding
Returns an array of network-read `CallForwardingRule` values. Empty is valid only when the bridge successfully queried the network and no rule exists. Adapter failure returns a non-2xx response instead of an invented empty success.

## PUT /v1/devices/:deviceId/call-forwarding
Request body is `CallForwardingRequest.rule`; headers include `Idempotency-Key`.

A 2xx response means the modem/network accepted the command, not that forwarding is verified. The response sets `verified: false` until a separate read-back matches the requested rule.

## POST /v1/devices/:deviceId/call-forwarding/verify
Reads the active network rule and returns it. ATLAS marks a rule verified only when the returned reason, destination, enabled state, and no-answer delay match the request.

## Adapter selection
After hardware identification, choose the first authenticated mechanism that capability probing confirms: manufacturer API, QMI/MBIM/AT, then USSD/MMI. No transport is assumed from carrier name alone.

## Audit
Every write records request id, idempotency key, actor id, tenant id, organization id, device id, requested rule, transport selected, normalized modem/network response, error code, and timestamp.
```

- [ ] **Step 4: Commit the hardware boundary documentation**

```bash
git add docs/telecom/mifi-bridge-protocol.md tests/unit/telecom-mifi.test.ts
git commit -m "docs: define MiFi hardware bridge contract"
```

---

### Task 6: Full verification gate

**Files:**
- No new files unless a gate exposes a defect in a file changed above.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: evidence that the repository-level slice is internally consistent and buildable, without claiming physical MiFi forwarding is active.

- [ ] **Step 1: Run the full unit suite**

Run:

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 2: Run the full integration suite**

Run:

```bash
npm run test:integration
```

Expected: PASS.

- [ ] **Step 3: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run TypeScript validation**

Run:

```bash
npm run typecheck
```

Expected: PASS with zero TypeScript errors.

- [ ] **Step 5: Build the web application**

Run:

```bash
npm run build
```

Expected: PASS and a Vite production bundle.

- [ ] **Step 6: Inspect final changes for whitespace errors, prohibited raw modem access, and accidental user-number constants**

Run:

```bash
git diff --check
git grep -nE 'AT\+|ATD|qmicli|mbimcli' -- apps/web/src || true
git grep -nE '(4072344222|7867849945|407-234-4222|786-784-9945)' -- apps/web packages/telecom || true
```

Expected: `git diff --check` has no output; browser source contains no raw modem commands; the user's real telephone numbers do not appear in source.

- [ ] **Step 7: Record the implementation state accurately**

The completion report must state:

`ATLAS Telecom MiFi Control software slice implemented and repository gates passed. Physical call forwarding is not verified until the exact MiFi hardware is identified, an authorized bridge adapter is connected, the carrier accepts the rule, and a real test call plus network read-back succeeds.`

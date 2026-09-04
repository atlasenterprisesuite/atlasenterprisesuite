# ATLAS Telecom — MiFi Control Design

## Status
Approved in chat on 2026-09-04. This specification defines the software architecture for adding MiFi voice-network controls to ATLAS without claiming unsupported carrier or hardware capabilities.

## Goal
Add an ATLAS Telecom / Connect control surface that can manage a MiFi cellular line, beginning with call forwarding, while preserving tenant isolation, explicit capability detection, auditability, and truthful live-state reporting.

The initial target line is a Mint Mobile SIM used in a MiFi/hotspot. The desired user flow is to forward incoming calls from the MiFi line to another authorized telephone number. Telephone numbers are configuration data and must not be hard-coded in source.

## Product ownership and navigation
Primary owner: **ATLAS Telecom**.
Secondary integration: **ATLAS Connect** for future call history, voicemail, transcription, and communications workflows.

Navigation:

`ATLAS → Telecom → Devices → MiFi → Voice & Call Forwarding`

Canonical route for the first slice:

`/telecom/devices/mifi`

The Enterprise home and global sidebar expose Telecom only when the route exists. The MiFi page must remain usable on desktop, tablet, and mobile.

## Current repository constraints
The current web application is React 18 + TypeScript + Vite with React Router. Domain logic is tested through Vitest and existing business logic lives in `packages/*`. The current `apps/web/src/modules` snapshot contains Finance only, so Telecom is a new module in this repository snapshot rather than an extension of an existing Telecom implementation.

There is no device-control backend in the current snapshot. Therefore browser code must not directly issue modem commands, pretend to contact Mint, or report network state that was not returned by an authorized device adapter.

## Architecture
The feature is split into four isolated units:

1. **Telecom domain package** — pure TypeScript types, validation, capability modeling, state transitions, and call-forwarding request construction.
2. **MiFi control UI** — route, forms, capability/status display, and user actions. It consumes only the adapter contract, not vendor-specific commands.
3. **Device adapter boundary** — normalized interface between ATLAS and a future local/embedded MiFi bridge. The default repository adapter is `unavailable`, never a fake live adapter.
4. **Hardware bridge protocol** — a documented contract for a future embedded/edge agent that may use AT commands, USSD/MMI, QMI, MBIM, or a manufacturer API only after the actual MiFi hardware is identified and capability-probed.

This design deliberately does **not** flash or replace firmware in the first software slice. Firmware modification is a separate hardware-specific project because a wrong image can permanently disable a MiFi.

## Domain model
Create `packages/telecom/src/types.ts` with these public types:

```ts
export type ForwardingReason = 'all' | 'busy' | 'no-answer' | 'not-reachable';
export type DeviceConnectionState = 'unavailable' | 'discovering' | 'connected' | 'error';
export type OperationState = 'idle' | 'submitting' | 'verified' | 'failed';

export interface TenantScope {
  tenantId: string;
  organizationId: string;
}

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

## Validation rules
- Destination numbers must be normalized to E.164 before a request is accepted.
- US NANP input may be entered as 10 digits, 11 digits beginning with `1`, or `+1...`; the normalized stored value is `+1XXXXXXXXXX`.
- Unsupported or malformed numbers fail locally before reaching an adapter.
- `noAnswerSeconds` is allowed only for `no-answer` and must be an integer from 5 through 30 inclusive.
- A requested forwarding reason must exist in `device.capabilities.callForwardingReasons`.
- If `device.capabilities.callForwarding === false`, activation and verification actions remain disabled.
- Tenant and organization scope on a request must match the active device scope.

## Adapter contract
Create `packages/telecom/src/adapter.ts`:

```ts
export interface MifiAdapter {
  getDevice(deviceId: string, scope: TenantScope): Promise<MifiDevice>;
  getCallForwarding(deviceId: string, scope: TenantScope): Promise<CallForwardingRule[]>;
  setCallForwarding(request: CallForwardingRequest): Promise<CallForwardingResult>;
  verifyCallForwarding(deviceId: string, scope: TenantScope): Promise<CallForwardingRule[]>;
}
```

The repository default implementation is `UnavailableMifiAdapter`. It returns an explicit unavailable device state and rejects write operations with a typed `ADAPTER_UNAVAILABLE` error. It must not simulate carrier acceptance.

## Hardware bridge contract
The future bridge is a local or embedded service controlled by ATLAS. Its responsibilities are:

- discover the modem and transport available on the actual MiFi;
- report capabilities before enabling controls;
- translate normalized ATLAS call-forwarding requests to a supported modem mechanism;
- return the modem/network response verbatim enough for audit and diagnosis;
- never expose SIM secrets, authentication credentials, or raw privileged interfaces to browser clients;
- require an authenticated, scoped ATLAS request for write operations;
- provide an idempotency key for write requests;
- keep an audit record of actor, tenant, organization, device, requested rule, result, and timestamp.

Preferred command order after hardware identification:

1. Manufacturer-supported local API when documented and authenticated.
2. Standard modem control supported by the hardware (QMI/MBIM/AT).
3. USSD/MMI only when the device exposes it safely and carrier behavior is verified.

No command family is assumed to work until capability probing confirms it.

## UI behavior
Create `apps/web/src/modules/telecom/MifiControlPage.tsx`.

The page contains:

- Breadcrumb: `Telecom / Devices / MiFi`.
- Device card: display name, carrier, line number, and connection state.
- Capability panel: Call Forwarding, SMS, USSD, AT, QMI, MBIM with explicit supported/unsupported/unknown presentation.
- Call Forwarding card with enable switch, destination input, reason selector, optional no-answer seconds, Activate, Verify, and Disable actions.
- Result area with `idle`, `submitting`, `verified`, and `failed` states.
- A persistent development notice when the adapter is unavailable: `No authorized MiFi device adapter is connected. ATLAS will not report carrier state until a real modem confirms it.`

Do not display `Live`, `Connected`, `Verified`, or carrier-confirmed language unless returned by a real adapter.

## Initial device configuration
The first user-owned MiFi should be represented as configuration, not source constants. Until a real adapter is connected, the page may show the user-entered line and carrier as local configuration while the connection state remains `unavailable`.

No live forwarding rule is persisted merely because the user presses Activate. A rule becomes verified only when `verifyCallForwarding()` returns a matching network-confirmed rule.

## Permissions and audit
Define two logical permissions for future RBAC wiring:

- `telecom.mifi.read`
- `telecom.mifi.forwarding.write`

The current repository snapshot does not expose a shared RBAC service. The UI must therefore keep write controls disabled unless a future authorization adapter grants write access; it must not invent permission success.

Every future hardware write must create an audit event. Browser-only local form changes are not network audit events.

## Error handling
Typed failure codes:

- `ADAPTER_UNAVAILABLE`
- `DEVICE_NOT_FOUND`
- `CAPABILITY_UNSUPPORTED`
- `INVALID_DESTINATION`
- `SCOPE_MISMATCH`
- `NETWORK_REJECTED`
- `VERIFICATION_MISMATCH`

The UI maps these to concise user messages and preserves the last safe network state.

## Testing
### Unit tests
`tests/unit/telecom-mifi.test.ts` covers:
- E.164 normalization;
- invalid destination rejection;
- reason capability checks;
- `noAnswerSeconds` validation;
- tenant-scope mismatch rejection;
- unavailable adapter write rejection;
- verified state only after a matching verification response.

### Integration tests
`tests/integration/mifi-route.test.tsx` covers:
- `/telecom/devices/mifi` renders under the ATLAS shell;
- Telecom appears in navigation;
- unavailable-adapter notice is visible;
- Activate is disabled when call forwarding capability is unavailable;
- destination validation is rendered accessibly;
- no false `Connected` or `Verified` state appears.

### Repository gates
Run:

```bash
npm test
npm run typecheck
npm run build
```

All must pass before merge.

## Production gate
This feature is **not production-live device control** until all of these are true:

1. The exact MiFi make/model and modem transport are identified.
2. An authorized hardware/device adapter is implemented.
3. Capability probing confirms a supported call-forwarding mechanism.
4. A real test call proves the carrier forwards the MiFi line to the configured destination.
5. Verification reads the forwarding rule back from the modem/network.
6. Authentication, RBAC, tenant isolation, and audit logging are active for writes.
7. The production deployment gates pass.

Until then, production UI must say that no authorized MiFi adapter is connected.

## Out of scope for this slice
- flashing unknown MiFi firmware;
- bypassing carrier restrictions;
- changing SIM/eSIM provisioning;
- recording calls;
- AI call answering;
- voicemail transcription;
- SMS forwarding;
- fabricated signal, usage, or call metrics.

Those can be added as separate ATLAS Telecom/Connect milestones after the call-forwarding control path is proven on the actual hardware.

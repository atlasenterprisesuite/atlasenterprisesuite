# ATLAS Local Control Plane design

Date: 2026-09-18

## Objective

Extend ATLAS Local Network Access into a governed Local Control Plane for devices that cannot safely expose browser CORS endpoints. The control plane adds an ATLAS Local Agent runtime, organization-scoped device identity, short-lived credentials, capability-aware command routing, health/event telemetry, and a truthful UI in Device OS.

## Trust model

- Browser LNA remains the preferred direct transport for explicit allowlisted HTTP(S) endpoints.
- The Local Agent is a separate runtime for devices that require a local bridge.
- Enrollment uses a one-time random code. Only a SHA-256 digest is stored server-side.
- Successful enrollment issues a short-lived opaque agent session token. Only its SHA-256 digest is stored server-side.
- Agent sessions expire and may be rotated. Revoked agents cannot authenticate.
- No ATLAS bearer token, provider credential, browser cookie, or enrollment/session secret is stored in device telemetry or audit records.
- Device and agent records are organization scoped and protected by RLS.
- Direct authenticated table writes are denied; mutations go through the Local Control Edge Function.
- There is no subnet scanning or automatic discovery in this phase. Agents report only explicitly configured devices.

## Data model

- `atlas_local_agents`: registered Local Agent identities and health.
- `atlas_local_agent_enrollments`: one-time enrollment digests and expiry.
- `atlas_local_agent_sessions`: short-lived agent session digests.
- `atlas_local_devices`: explicitly registered physical/local services and their declared capabilities.
- `atlas_local_device_commands`: capability/action references queued for a specific registered device. No arbitrary secret-bearing payload is persisted.
- `atlas_local_device_events`: append-only safe telemetry and command evidence.

## Operations

Human/user operations:
- `agents.list`
- `enrollment.create`
- `devices.list`
- `commands.list`
- `commands.enqueue`
- `agents.revoke`

Agent operations:
- `agent.enroll`
- `agent.heartbeat`
- `agent.devices.sync`
- `agent.commands.claim`
- `agent.commands.complete`
- `agent.events.append`

## Command governance

P0 supports only reference-based commands: device id, capability, action, risk level, and optional canonical approval id. It does not persist arbitrary command bodies.

- `low` and `medium` risk commands require `device.agent.use`.
- `high` and `critical` commands fail closed unless they carry a canonical ATLAS Execution approval that is already approved and bound to a Device OS execution step. The Local Control Plane never creates a second approval system.
- The Local Agent may claim only commands for its own organization and devices.
- Unsupported device adapters/actions must return an explicit failure; they are never simulated.

## Local Agent runtime

A reference Node runtime is provided for enrollment, heartbeat, explicit device inventory sync and command polling. It keeps its session token in process memory and does not write credentials to repository files or logs. Device adapters are explicit plugins/configuration; the default runtime does not claim real printer/POS/lock/vehicle support.

## Cross-module adoption

Device OS owns the control plane. Connect, Hospitality, POS, Inventory, Ride and other modules may reference registered devices/capabilities through adapters, but do not create parallel identity, session, approval or audit systems.

## Follow-on adapter work

Real vendor/device adapters remain external-gated until their official protocol, authorization and hardware are available. Examples: printer protocols, POS terminals, Matter/Thread bridges, hotel access vendors, cameras, MiFi/modems and vehicle interfaces.

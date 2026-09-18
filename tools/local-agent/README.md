# ATLAS Local Agent reference runtime

This is the reference runtime for the ATLAS Local Control Plane. It does not scan the LAN and it does not claim generic hardware support.

## Required environment

- `ATLAS_LOCAL_CONTROL_URL`: the deployed `atlas-local-control` Edge Function URL.
- First enrollment: `ATLAS_AGENT_ENROLLMENT_CODE` from Device OS. The code is single-use and expires quickly.
- Existing short session: `ATLAS_AGENT_SESSION_TOKEN` may be supplied instead of an enrollment code. Sessions expire and are rotated by heartbeat.
- `ATLAS_LOCAL_DEVICES_JSON`: explicit local device definitions. Do not put credentials in endpoint URLs or synced metadata.

Example device configuration:

```json
[
  {
    "external_id": "front-desk-health",
    "label": "Front Desk Local Service",
    "device_type": "service",
    "adapter": "http-health",
    "capabilities": ["health.check"],
    "endpoint": "http://192.168.1.20:8080/health"
  }
]
```

The P0 `http-health` adapter performs only `health.check/status.read`. Unsupported commands fail explicitly. Provider-specific printers, POS, hotel locks, Matter/Thread, cameras, modems and vehicle adapters require their real supported protocol and authorization before being added.

Run with Node 22+:

```bash
node tools/local-agent/atlas-local-agent.mjs
```

Treat enrollment/session values as secrets. Supply them through the host service manager or secret store; never commit them, place them in tickets, or print them to logs.

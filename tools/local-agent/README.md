# ATLAS Local Agent

ATLAS Local Agent is the machine-side runtime for the ATLAS Local Control Plane. It bridges explicitly configured local devices without scanning the LAN and without turning hardware claims into simulated state.

## Runtime model

- One-time enrollment creates an ATLAS agent and a short-lived session.
- Rotated session state is persisted in an OS-protected state file so normal restarts do not require a new enrollment.
- The enrollment file is consumed and deleted after successful enrollment.
- mTLS private keys are generated on the machine and never uploaded to ATLAS, GitHub, Cloudflare, logs, or device telemetry.
- When a Cloudflare-managed client certificate is installed and bound to the agent, the runtime connects to the ATLAS Realtime Command Bus over WSS + mTLS.
- Realtime messages contain only a command reference. The real command is claimed from `atlas-local-control`, preserving the canonical tenant, RBAC, approval, and audit gates.
- If realtime is unavailable, the agent falls back to a bounded polling loop.

A session that expires while the agent is offline cannot be recovered from a permanent master token. Re-enroll the machine. This is intentional.

## Installers

Run from this directory after obtaining a one-time enrollment code in Device OS:

- Linux: `sudo ./install-linux.sh`
- macOS: `sudo ./install-macos.sh`
- Windows PowerShell as Administrator: `.\install-windows.ps1`

The installer requires Node.js 22+ and OpenSSL. It creates a 3072-bit RSA private key and a CSR locally.

Default locations:

| OS | Runtime/config |
| --- | --- |
| Linux | `/opt/atlas/local-agent`, `/etc/atlas/local-agent`, `/var/lib/atlas/local-agent` |
| macOS | `/Library/Application Support/ATLAS/LocalAgent` |
| Windows | `%ProgramData%\ATLAS\LocalAgent` |

Linux uses systemd, macOS uses a LaunchDaemon, and Windows uses a SYSTEM startup scheduled task with restricted ACLs.

## Issue the mTLS certificate

1. Generate the key/CSR with the installer. Keep `agent.key` on the machine.
2. Base64-encode only `agent.csr`.
3. Run the GitHub workflow **ATLAS Local Agent mTLS** with action `issue`, the ATLAS organization ID, agent ID, and CSR.
4. The workflow ensures the Cloudflare-managed CA is associated with `www.atlasenterprisesuite.com`, issues the public client certificate, and synchronizes fingerprint/serial/expiry back into ATLAS using GitHub OIDC.
5. Download the short-lived workflow artifact and save `atlas-local-agent.crt` to the installer-configured `agent.crt` location.
6. Restart the service. The agent will use WSS+mTLS; polling remains the safety fallback.

The Cloudflare production token must have **SSL and Certificates Write** for issuance/revocation. The workflow fails closed if that permission is absent.

To revoke a certificate, run the same workflow with action `revoke` and its Cloudflare certificate ID. Provider revocation occurs before ATLAS is marked revoked.

## Explicit device configuration

The agent reads the installer-managed `devices.json`. Do not put credentials in endpoint URLs or synced metadata.

Example:

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

The foundation `http-health` adapter performs only `health.check/status.read`. Unsupported operations fail explicitly.

## Adapter policy

Provider/device-specific adapters must have a real protocol contract and authorization before ATLAS marks them available. The next standardized adapter is IPP printer read-only status; POS, hotel access, Matter/Thread, cameras, modems and vehicle interfaces remain external-gated until their supported interfaces are verified.

## Distribution integrity

Installer source is versioned in the canonical ATLAS repository. Release packaging must include SHA-256 checksums and GitHub build provenance where the repository plan supports attestations. Apple notarization and Microsoft Authenticode are separate code-signing credentials; ATLAS must not label packages as Apple/Microsoft signed until those credentials and signing workflows are configured.

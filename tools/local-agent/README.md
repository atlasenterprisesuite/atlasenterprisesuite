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


## ATLAS Local AI Runtime — zero external API spend

ATLAS can run model inference on hardware you control instead of sending prompts to a metered AI API. The canonical provider id is `atlas-local`.

The reference launcher uses `llama-server` through `tools/local-agent/atlas-local-ai-runtime.mjs`. ATLAS keeps tenant isolation, RBAC, audit, cost policy and tool approvals outside the model runtime.

Required runtime environment:

- `ATLAS_LOCAL_AI_TOKEN`: random bearer token. Never commit it.
- Either `ATLAS_LOCAL_AI_MODEL_FILE` for an existing GGUF model or `ATLAS_LOCAL_AI_HF_REPO` for a compatible Hugging Face GGUF repository.
- `ATLAS_LOCAL_AI_BINARY`: optional path/name for `llama-server`.
- `ATLAS_LOCAL_AI_HOST`: defaults to `127.0.0.1`.
- `ATLAS_LOCAL_AI_PORT`: defaults to `8080`.
- `ATLAS_LOCAL_AI_CONTEXT`: defaults to `32768`.
- `ATLAS_LOCAL_AI_GPU_LAYERS`: optional integer GPU offload setting.

Start the reference runtime:

```bash
node tools/local-agent/atlas-local-ai-runtime.mjs
```

The launcher passes the model runtime API key through `LLAMA_API_KEY` rather than a command-line secret.

Because the deployed Supabase Edge `atlas-copilot` cannot reach a loopback-only service directly, expose the runtime only through an authenticated HTTPS reverse proxy/tunnel when remote ATLAS access is required. Do not expose an unauthenticated inference server to the public internet.

Server-side ATLAS configuration:

```text
ATLAS_LOCAL_AI_URL=https://<authorized-runtime-host>
ATLAS_LOCAL_AI_TOKEN=<same-runtime-token>
ATLAS_LOCAL_AI_MODEL=<runtime model id/alias>
ATLAS_AI_ENFORCE_ZERO_COST=true
ATLAS_AI_ALLOW_PAID_SINGLE=false
ATLAS_AI_ALLOW_COUNCIL=false
ATLAS_AI_ZERO_COST_PROVIDERS=atlas-local
```

ATLAS does not mark the runtime ready merely because variables exist. The `/health` probe must verify successfully. If `atlas-local` is unavailable, strict zero-cost mode blocks paid fallbacks instead of silently spending money.

“Zero cost” means zero automatic third-party AI API charges. Local hardware, electricity, internet, storage, and optional hosting/tunnel costs remain outside the model API cost boundary.


## ATLAS Browser Operator

The Local Agent can expose an explicitly configured Chrome/Chromium browser as an audited `browser-cdp` device. It uses the same enrollment, tenant isolation, command queue, realtime mTLS bus, approval gates and audit stream as other local devices.

Example `devices.json` entry:

```json
[
  {
    "external_id": "atlas-browser",
    "label": "ATLAS Browser Operator",
    "device_type": "browser",
    "adapter": "browser-cdp",
    "capabilities": ["browser.control"],
    "metadata": {
      "allowed_domains": [
        "hubspot.com",
        "supabase.co",
        "atlasenterprisesuite.com"
      ]
    }
  }
]
```

Supported browser actions are `navigate`, `read_text`, `click`, `type`, `submit`, and the explicit high-risk `oauth_consent` action. Every command carries a bounded non-secret `action_payload` and is restricted to the device domain allowlist. Navigation is HTTPS-only. Semantic targets such as `text:Choose Account` use exact normalized text/ARIA matching and must resolve to exactly one interactive control.

Ordinary `click` or `submit` commands refuse controls that look like OAuth consent (for example “Choose Account”, “Authorize”, “Allow”, or “Approve”). Provider consent must be represented as `oauth_consent`, marked `high` or `critical`, and bound to an already-approved canonical ATLAS execution approval whose current step payload exactly matches the device, capability, action, and action payload. This keeps ATLAS Work/Approval Center as the decision layer while the Local Agent + mTLS/Reatime Command Bus remains the single execution substrate.

Password/OTP/token/card-like typing is blocked using both the requested target and the live DOM field attributes. Browser evidence strips URL userinfo, query strings, and fragments before it is sent back, so OAuth `code`/`state` values are not persisted in event detail. The operator binds Chrome DevTools Protocol only to `127.0.0.1` and launches a dedicated browser profile by default.

Optional environment variables:

- `ATLAS_BROWSER_EXECUTABLE`: explicit Chrome/Chromium executable path.
- `ATLAS_BROWSER_PROFILE_DIR`: persistent dedicated operator profile.
- `ATLAS_BROWSER_CDP_PORT`: loopback CDP port, default `9222`.
- `ATLAS_BROWSER_HEADLESS=true`: optional headless execution. Interactive OAuth usually needs the visible browser profile.

ATLAS must not claim a browser action occurred unless the Local Agent reports the audited command as succeeded.

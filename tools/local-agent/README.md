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


## Governed Browser Runtime

ATLAS Work can execute browser actions through a dedicated local Chromium profile without granting unrestricted desktop control. The runtime is `tools/local-agent/atlas-work-browser-runtime.mjs` and consumes only jobs already authorized by the ATLAS Work route, policy, tenant/RBAC and execution-envelope layers.

Security boundaries:

- Chromium DevTools Protocol is accepted only on loopback (`127.0.0.1`, `localhost`, or `::1`).
- Navigation is HTTPS-only and the action hostname must match the declared domain.
- The runtime independently re-checks envelope expiry, domain allowlist and action allowlist before every action.
- Server-supplied JavaScript is never evaluated. ATLAS uses fixed runtime code plus bounded CSS selectors and scalar values.
- Password, secret, token, OTP, CVC/CVV and credit-card-like inputs are denied.
- Cookies, authorization values, credentials and private keys are stripped from runtime result data.
- Ordinary `click` or `submit` actions that resemble OAuth consent return `waiting_human`.
- OAuth consent must use the explicit `oauth_consent` action. The server refuses to queue that action unless a canonical `execution.approve` approval with high/critical risk is approved and still matches the exact current task/step payload.

Required runtime values are issued by ATLAS Work when a Local or Self-Hosted runtime is enrolled:

```text
ATLAS_WORK_RUNTIME_ID=<runtime id>
ATLAS_WORK_RUNTIME_TOKEN=<one-time runtime token>
ATLAS_BROWSER_CDP_URL=http://127.0.0.1:9222
```

Start Chrome/Chromium with a dedicated ATLAS browser profile and loopback-only remote debugging, sign into provider sites in that profile yourself, then start:

```bash
node tools/local-agent/atlas-work-browser-runtime.mjs
```

ATLAS never receives the browser-profile password. The Work runtime token authenticates only the job queue; it is not a provider credential. A revoked runtime stops receiving work. Browser jobs use five-minute leases and sanitized completion evidence.

For provider authorization flows such as HubSpot, the sequence is: ATLAS creates the OAuth URL -> the dedicated browser navigates -> the account choice is read -> ATLAS requests canonical approval -> after approval, an `oauth_consent` action may click the account/authorization control -> provider redirects to the existing ATLAS OAuth callback -> ATLAS validates state/scopes/account and persists only encrypted provider credentials.

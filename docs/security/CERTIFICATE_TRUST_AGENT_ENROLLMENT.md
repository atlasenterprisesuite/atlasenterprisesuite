# ATLAS Certificate Trust Agent — Authorized Enrollment

Status: **runtime profile implemented in repository**; production host enrollment and mTLS certificate **not yet verified**.

This is a least-privilege profile of the existing ATLAS Local Agent. It does not create a second identity service, store reusable enrollment credentials, enumerate local devices, browse the web, execute remote commands, or create Cloudflare certificates by itself.

## Human trust boundary (required)

The owner/admin must be authenticated in ATLAS and have `device.agent.admin` for the correct organization. ChatGPT / GitHub repository write access is **not** equivalent to permission to create an ATLAS enrolled agent.

1. Open `https://www.atlasenterprisesuite.com/device-os` → **Agents & Devices**.
2. In **Agent name** enter **ATLAS-Certificate-Trust-Agent-01** and select **Create one-time enrollment**. The one-time code expires after 10 minutes, is displayed once, and must be entered **only on the intended physical host**, not pasted into chat/GitHub/issues/logs.
3. On the approved host, install from a reviewed **exact Git commit** of `atlasenterprisesuite/atlasenterprisesuite` (no curl|bash; inspect scripts first). Require Node.js 22+ and OpenSSL in PATH. Use the commands in the applicable section below, from the checked-out `tools/local-agent` directory.
4. After local installer asks for the short-lived code, enter it on the local console. Confirm ATLAS Device OS lists the newly enrolled agent by its **real platform** and **real agent ID**. No claims of authorization until that session exists.
5. The installer generates a 3072-bit RSA private key **on the agent host** (restricted OS permissions) and a public CSR. Never send the private key. Do not copy the enrollment code into shell command history or ATLAS logs.

### Linux (Ubuntu 24.04)

```bash
# From a reviewed checkout of the canonical ATLAS repository
cd tools/local-agent
sudo env ATLAS_AGENT_PROFILE=certificate-trust ./install-linux.sh
sudo systemctl status atlas-local-agent --no-pager
# Public CSR (safe to submit to the official GitHub issuer workflow only):
sudo cat /etc/atlas/local-agent/agent.csr
```

### Windows

Open PowerShell as Administrator in the reviewed checkout:

```powershell
cd tools\local-agent
$env:ATLAS_AGENT_PROFILE = 'certificate-trust'
.\install-windows.ps1
Remove-Item Env:ATLAS_AGENT_PROFILE
Get-ScheduledTask -TaskName 'ATLAS Local Agent'
Get-Content "$env:ProgramData\ATLAS\LocalAgent\config\agent.csr"
```

### macOS

```bash
cd tools/local-agent
sudo env ATLAS_AGENT_PROFILE=certificate-trust ./install-macos.sh
sudo cat '/Library/Application Support/ATLAS/LocalAgent/config/agent.csr'
```

## Certificate issuance — only after real enrollment

1. Obtain `organization_id` and the enrolled `agent_id` from the authenticated control plane. Do not fabricate UUIDs or substitute GitHub account identity.
2. Run the existing GitHub workflow [ATLAS Local Agent mTLS](https://github.com/atlasenterprisesuite/atlasenterprisesuite/actions/workflows/local-agent-mtls.yml) with `action=issue`, tenant/agent IDs and the Base64 representation of **only** the locally generated CSR. Never submit the private key.
3. Cloudflare must issue the public client certificate and the GitHub OIDC callback must bind the provider-issued fingerprint / serial / expiry. If the production token lacks **SSL and Certificates Write** permission, fail closed.
4. Download the short-lived **public certificate artifact** and install `atlas-local-agent.crt` at the configured `agent.crt` path, with OS-appropriate permissions. Restart the agent.
5. Require a real authorized WSS+mTLS handshake, matching fingerprint/serial/expiry and correct tenant session. Confirm `realtime_last_connected_at` was updated by that gate. If missing, state **NOT VERIFIED**.
6. Invalidate the certificate with the provider-side revoke flow before declaring revocation effective; application-only revocation is not enough.

The certificate trust profile exposes only `heartbeat` and `command.realtime` capabilities, and intentionally refuses device inventory and command execution. A connected agent is **not** evidence that an automatic renewal protocol works.

## Security and current limitations

- The device holds the private key; ATLAS stores only authorized enrollment/session metadata and public certificate identity.
- The current mTLS issuance workflow marks a binding active before the certificate is installed and proves a handshake. Thus *issued* is not equivalent to *live authenticated*. Follow [issue #733](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/733) for staged rotation and provider-bound proof of possession.
- Avoid reusing an existing agent name: the backend performs an upsert on `org_id,name`. Use a uniquely named physical-host agent for the first enrollment.
- This profile cannot be installed remotely from the ChatGPT or GitHub connections. The one-time code and private key require the local machine.
- The [certificate lifecycle auditor](https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/732) is a separate PR and must be merged and verified independently.

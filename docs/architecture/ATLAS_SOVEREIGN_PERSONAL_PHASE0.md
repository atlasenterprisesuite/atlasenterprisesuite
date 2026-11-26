# ATLAS Sovereign Personal AI — Phase 0 (owner-only local runtime)

Status: **source-level implementation / pending physical Windows verification**. This is a private-use profile for ATLAS Local Core, not a second control plane and not a trained proprietary foundation model.

## Objective

One owner controls the local model, encrypted device memory and future permitted tools. No public endpoint, public registration, automatic provider fallback, hidden model download, or background agent enrollment.

## Reused source

- `tools/local-agent/atlas-local-core-device.mjs` — personal command-line entrypoint.
- `tools/local-agent/lib/local-core-client.mjs` — authenticated HTTP client restricted to loopback.
- `tools/local-agent/lib/local-core-vault.mjs` — encrypted local notes.
- `tools/local-agent/atlas-local-ai-runtime.mjs` — existing llama.cpp launcher.
- `tools/local-agent/lib/local-core-runtime-policy.mjs` — validates the server binding and explicit offline model requirement.

## Phase 0 guarantees and limitations

- `atlas-local-core runtime` forces `ATLAS_LOCAL_AI_OFFLINE=true` before loading the server launcher.
- The launcher accepts only numeric loopback bind addresses (`127.0.0.1` or `::1`); it refuses LAN and public addresses, including when invoked directly.
- Strict offline mode requires a local model file path and refuses `ATLAS_LOCAL_AI_HF_REPO` downloads. An existing separately administered cloud bootstrap may continue to use its explicit online model provisioning path.
- There is no automatic remote fallback from the personal inference client.
- The installer does not obtain a model, start services, enroll the computer, or grant remote control.
- The local vault is protected by the device account and a passphrase, but administrator/SYSTEM access to the machine is outside this boundary. It is not evidence of sole physical control or a verified owner identity.
- No model file integrity, offline real inference, local malware isolation, signing or Windows device compatibility is yet certified.

## Windows start (after user-reviewed source and trusted local model acquisition)

From a checkout of the official ATLAS repository, using a normal, non-administrator Windows user with Node.js 22 or later:

```powershell
.\tools\local-agent\install-local-core-windows.ps1
& "$env:LOCALAPPDATA\ATLAS\LocalCore\atlas-local-core.cmd" doctor
```

To launch the personal model, separately install a trusted llama.cpp `llama-server` and a compatible local GGUF file. Verify model provenance and obtain its digest. Set `ATLAS_LOCAL_AI_BINARY` and `ATLAS_LOCAL_AI_MODEL_FILE` to local absolute paths, and set a unique random `ATLAS_LOCAL_AI_TOKEN` in the launch session. Then:

```powershell
& "$env:LOCALAPPDATA\ATLAS\LocalCore\atlas-local-core.cmd" runtime
```

The `ask` command needs the same token in another authenticated local terminal. Do not paste the token or vault passphrase into chats, source control, PowerShell history or logs. No password storage/sharing UX is yet provided; this manual secret boundary is intentional in Phase 0.

## Evidence gates (P0 fail closed)

1. `npm run test:local-core` on the proposed commit (negative tests for binding, offline downloader and personal entrypoint).
2. CI on the exact PR SHA, dependency/security review and installer packaging tests.
3. Actual Windows hardware: installed file provenance, user ACL review, private vault correctness and incorrect-passphrase rejection.
4. Actual local GGUF `llama-server` inference with network disconnected and packet-capture review, no remote listener.
5. Later: signed installer, backup/recovery procedure, local owner authentication, iPhone pairing with revocation, E2E UI.
6. No merge, release, unattended provider connection or production certification while required gates remain unverified.

The repository can be public; personal conversations, vault contents, keys, model credentials and private data must **never** be committed.

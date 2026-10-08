# ATLAS Local Core Wave 2

Status: portable prototype. A green build or a deployed web screen does not certify an install, an offline model, or a device connection.

## Security boundaries

- Reuse the existing tools/local-agent/atlas-local-ai-runtime.mjs and loopback-only local-core-client.mjs.
- The new installers are independent of the existing remote Local Agent and cloud-tunnel installer: they do not create a service, enroll a device, call external APIs, download models, or send private vault contents to ATLAS.
- Device OS shows "Device not verified" until real hardware evidence exists.
- Windows script is not a signed .exe/.msi; Ubuntu script is not a signed .deb. Code-signing and release provenance remain gated.

## Windows 11 — PowerShell and Node.js 22+

From the ATLAS repository checkout, as a normal user (not Administrator):

    .\tools\local-agent\install-local-core-windows.ps1
    & "$env:LOCALAPPDATA\ATLAS\LocalCore\atlas-local-core.cmd" doctor
    & "$env:LOCALAPPDATA\ATLAS\LocalCore\atlas-local-core.cmd" memory put notes
    & "$env:LOCALAPPDATA\ATLAS\LocalCore\atlas-local-core.cmd" memory get notes

Installs in %LOCALAPPDATA%\ATLAS\LocalCore. The installer uses icacls to restrict the runtime and private vault to the current user SID and SYSTEM. It fails if ACL setup is unsuccessful.

## Ubuntu 24.04 — Bash and Node.js 22+

From the repository checkout, without sudo:

    bash ./tools/local-agent/install-local-core-ubuntu.sh
    "$HOME/.local/share/atlas/local-core/atlas-local-core" doctor
    "$HOME/.local/share/atlas/local-core/atlas-local-core" memory put notes
    "$HOME/.local/share/atlas/local-core/atlas-local-core" memory get notes

If XDG_DATA_HOME is set, the executable is placed under that alternate data directory. The encrypted vault uses ~/.atlas/local-core/memory.v1.json, mode 0600, with 0700 on parent directories.

## Private vault details

Commands: memory put, get, list, delete. Entry identifiers are at most 64 safe characters. Memory values are at most 64 KiB. All entries and IDs are sealed as one JSON document under AES-256-GCM, with fresh per-write salt/nonce and a scrypt-derived key (N=32768, r=8, p=1). The CLI prompts for a passphrase interactively with terminal-hidden keystrokes; it is never supplied as an argument, environment variable, or stored by ATLAS. A passphrase shorter than 12 UTF-8 bytes is rejected; a long, unpredictable phrase is recommended. Lost passphrases cannot be recovered.

A lockfile prevents concurrent writes; atomic file replacement reduces risk of partial files. Invalid password/corruption fails closed. A crashed writer can leave a lock requiring manual recovery. The get command explicitly prints plaintext to the terminal; do not share terminal recordings or logs containing it. Deleting a key does not securely erase backups or storage snapshots. This vault is not multi-user, synced, hardware-key-backed, or an end-to-end encrypted cloud drive.

## Explicit inference setup

The installer does not install llama-server or GGUF model files. Separately obtain an authentic compatible model and trusted llama.cpp binary, then privately configure ATLAS_LOCAL_AI_BINARY, ATLAS_LOCAL_AI_MODEL_FILE, and a random ATLAS_LOCAL_AI_TOKEN. Launch atlas-local-core runtime in a local terminal. In another terminal with the same token, pipe a prompt to atlas-local-core ask. The local client has no automatic cloud fallback and refuses non-loopback API URLs; the Wave 2 runtime command refuses a non-loopback ATLAS_LOCAL_AI_HOST value.

## Remaining gates

1. Test suite: node --test tools/local-agent/tests/*.test.mjs and Bash parser.
2. GitHub CI typecheck, test, build, and dependency/security scans.
3. Real Windows: run PowerShell installer and inspect ACLs, vault operations and runtime with an actual model, including offline test and loopback enforcement.
4. Real Ubuntu: run installer unprivileged and inspect file modes, vault operations and real local-model inference, including offline test.
5. Sign and checksum distributables, verify hashes/provenance and update/rollback before declaring a managed release.
6. A deployed Device OS UI is not proof of local device installation. Production P0 must be verified independently using exact commit SHA.

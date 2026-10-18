# ATLAS Wi-Fi Security — reproducible evidence and guarded scope

**Date:** 2026-10-10  
**Status:** Research verified against public references; deterministic laboratory tests only. NOT integrated, deployed, or production-verified.  
**Owner:** ATLAS Security / Device OS / 777 REVIEW

## Sources and findings

1. NIST SP 800-153 (https://csrc.nist.gov/pubs/sp/800/153/final) governs WLAN design, configuration, maintenance and monitoring. WEP and WPA legacy modes are unsuitable for a new secure network.
2. Wi-Fi Alliance WPA3 announcement (https://www.globenewswire.com/news-release/2018/06/26/1529297/0/en/Wi-Fi-Alliance-introduces-Wi-Fi-CERTIFIED-WPA3-security.html) identifies SAE as a stronger password-authentication protocol. WPA3-SAE is not a guarantee that every router or downgrade configuration is safe.
3. WPA3 security considerations (https://wpa3.mathyvanhoef.com/WPA3_Security_Considerations_20190410.pdf) describe WPA2-Personal exposure in WPA3 transition mode using the same passphrase.
4. The Aircrack-ng sample-capture documentation (https://www.aircrack-ng.org/doku.php?id=wpa_capture) contains a WPA authentication lab capture; Wireshark docs (https://wiki.wireshark.org/howtodecrypt802.11) explain the EAPOL handshake and the conditions for decoding a capture with known credentials. Neither documents a universal password recovery method.
5. RFC 6070 (https://www.rfc-editor.org/rfc/rfc6070.html) publishes independently reproducible PBKDF2-HMAC-SHA1 test vectors. This repository validates its 4096-iteration, 20-byte vector as well as a deterministic synthetic WPA2 PMK example (`password`, SSID `IEEE`, 4096 rounds, 32 bytes). The latter example is a local fixture, not an intercepted credential.
6. NIST SP 800-63B-4 (https://pages.nist.gov/800-63-4/sp800-63b.html) provides current password-security guidance. These identity-password recommendations are a useful design reference, NOT a substitute for the 802.11 protocol's specific passphrase rules.

**Limit:** No universal technique can recover arbitrary Wi-Fi credentials; WPA2 password-guessing works only if suitable verification material exists and a candidate matches; WPA3-SAE resists traditional passive offline password guessing. A VPN protects selected traffic but does not reveal Wi-Fi credentials.

## Existing canonical ATLAS building blocks (reuse, do not duplicate)

- `supabase/migrations/20260925182000_atlas_wireless_network_control_plane.sql`: owned wireless **cellular/RAN** inventory, with tenancy/RLS; it is not a Wi-Fi audit engine.
- `supabase/migrations/20260918210000_atlas_local_network_access.sql`: Device OS browser LNA allowlist, organization permissions and append-only audit events.
- `docs/superpowers/specs/2026-09-18-atlas-local-network-access-design.md`: explicitly forbids LAN scanning, generic device discovery and automatic enumeration; browser LNA never confers implicit access.
- `docs/governance/ATLAS_MASTER_AUTONOMOUS_EXECUTION_PROTOCOL.md`: existing 777 release/verification gate remains authoritative.

## Implemented in this scoped PR

- A **pure offline-fixture-only** configuration-risk classifier in `packages/security/src/wifiAuditLab.mjs`. This accepts synthetic metadata only: protocol mode, WPS state and firmware-currency flag. It blocks unknown fields (including passwords/captures), missing declared authorization, organization mismatch, invalid input and any live-network scope.
- Deterministic unit tests in `tests/unit/wifi-audit-lab.test.ts` cover failure states, configuration findings and cryptographic reference vectors.
- No RF capture, sniffing, deauthentication, router admin access, WPS probing, password guessing, network traffic generation, VPN operation, or secret collection is implemented.
- `scope`, `permission`, `orgId` and `actorOrgId` are **synthetic lab fixtures only**. They do **not** substitute for real server-side session, role, scope, evidence verification or RLS controls. The returned `productionVerified` is always false.

## Reproduce

From the canonical repo root:

```bash
npm ci
npx vitest run tests/unit/wifi-audit-lab.test.ts
npm run typecheck
npm test
npm run build
```

A simple Node-only check of the RFC 6070 vector (no network or package installation):

```bash
node -e "const {pbkdf2Sync}=require('node:crypto'); const actual=pbkdf2Sync('password','salt',4096,20,'sha1').toString('hex');if(actual!=='4b007901b765489abead49d926f721d065a429c1') process.exit(1);console.log('RFC6070 PASS')"
```

## P0 gates before any live capability

1. Authenticate user and resolve current tenant server-side; enforce organization-bound RBAC/RLS, explicit scope/consent, rate limits and audit evidence. Do not trust client-supplied `orgId` or `permission`.
2. Preserve Local Network Access's no-scanning boundary; any potential future active authorized testing requires separate reviewed policy, explicit network ownership/permission, driver/platform constraints and enterprise risk assessment.
3. Never store, print, upload or return Wi-Fi passphrases, PMKs, captured frames, hardware identifiers or sensitive network inventories by default.
4. Build a real inventory adapter with explicit provenance and healthy external state; fail closed when missing/unverifiable.
5. Pass full tests, CodeQL and applicable 777 P0 gates with the **exact deployed SHA** before showing `FINAL PRODUCTION VERIFIED`.

**Current claim boundary:** Source changes and locally executed fixture tests may be confirmed with evidence. No assertion of deployed Wi-Fi functionality is authorized by these tests.

# ATLAS Secure Media Gateway 777 — RUN 001

## Public reference register (2026-11-23)
- https://developer.vimeo.com/ — developer entry point; detailed API contract not retrieved in this run.
- https://help.vimeo.com/hc/en-us/articles/12425432269201-About-the-Vimeo-Enterprise-plan — private library, folder permissions, SSO/SCIM, captions, analytics and live media.
- https://www.malwarebytes.com/solutions/scam-guard — scam-message analysis as product reference.
- https://www.malwarebytes.com/scam-check/link — URL reputation as product reference.
- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html — SSRF prevention, redirect and DNS controls.

Original implementation; no proprietary source, paid service, personal message, private URL or provider credential imported.

## Reuse
Extend tools/atlas-sentinel-shield (source scanner remains independent). Reuse packages/creator and the existing Creator Library for future media asset lifecycle. Do not create a parallel identity, storage or audit system. Existing credential scanner PR #1089 is separate and must retain its own review.

## Delivered scope
Offline Python URL syntax preflight with conservative HTTPS DNS-name policy. No DNS, HTTP, redirect following, threat database, malware scan, or browser navigation. All results NO_GO; well-formed host means UNVERIFIED only. No paths, queries, fragments or input values in rejected results. Host itself can be sensitive; do not persist or export results without an explicit retention policy. Run with Python unittest discovery in tools/atlas-sentinel-shield.

## Future P0 gates
1. Network resolver in isolated egress worker only after explicit authorization: validate every DNS answer and redirect, pin the validated address, enforce TLS identity, deny non-global targets, bound time/size/hops, never forward cookies/credentials. No automatic requests to personalized links. Test with controlled fixtures only.
2. Evidence-backed verdict policy: separate syntax, reputation, sender provenance, media integrity, and unknown. No trusted-domain shortcut. No external reputation calls by default.
3. Media ingestion: reuse tenant identity, object storage, asset IDs and audit. Explicit upload ownership, file-type validation and isolated scanning/transcoding with resource limits; no automatic remote download. Private-by-default, signed short-lived playback access, captions, accessibility, retention and deletion. Evaluate FFmpeg/HLS/WebVTT separately with license and sandbox review.
4. RBAC/RLS negative tests, cross-tenant isolation, exact-SHA required CI, independent review and production E2E. Existing branch protections must not be bypassed. Canonical Cloudflare/Supabase deployment only; no Vercel or spending in this run.

Status: offline prototype only. Production and network resolver NO_GO. No claims of antivirus or video hosting readiness.

## RUN 002 — offline redirect observation policy
- Prior HEAD 99abd770c556f317946ed9300ab83653fb093768: eight associated PR workflows completed successfully when rechecked.
- Added redirect_policy.py and five test methods; isolated local execution on Python 3.13 passed all five after the expected initial missing-module failure. Existing URL policy was reused in the local harness. Repository CI for the new HEAD is separate.
- Conservative address validation rejects mixed public/nonpublic answers, scoped IPv6, multicast, transition ranges, malformed inputs, repeated exact URLs, and excessive observations. Maximum six observations and sixteen addresses per hop. Output excludes raw URLs, hosts and IPs. Even accepted observations remain NO_GO, not evidence of an actual redirect chain.
- No live resolver, sockets, remote fetch, sender verification or TLS validation was implemented. Actual network worker remains blocked pending egress isolation, trusted DNS evidence, address pinning, redirect and response validation, and independent review. Media runtime remains pending.

## RUN 003 — local reputation and media reuse
Prior HEAD c802dfdad808743a24022bca413789d3e90358c8: eight associated workflows succeeded. Added offline reputation_policy.py and six test methods. Reports are untrusted input, not authenticated intelligence: adverse exact-host reports trigger review, positive reports never authorize access, missing reports remain unknown. No persistence or network requests. New CI pending.

Media reuse: canonical architecture docs/architecture/ATLAS_STUDIO_NATIVE_ORCHESTRA.md identifies apps/web -> atlas-creator-native Edge Function -> creator-native self-hosted service -> FFmpeg + local TTS -> private Supabase Storage -> creator_assets. Existing supabase/functions/atlas-creator-native/index.ts inserts assets and supabase/functions/atlas-creator/_shared/repository.ts reads asset metadata. Extend this path rather than inventing a media engine, database or storage bucket. Next verify actual asset authorization, integrity, scan evidence, signed playback, and tenant boundaries before enabling ingestion. Search excerpts are architecture evidence only, not runtime evidence. No live resolver or media runtime changes in this run.

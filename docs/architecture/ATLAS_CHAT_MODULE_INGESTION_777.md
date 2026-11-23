# ATLAS 777 REVIEW — Chat conversations to canonical modules (offline intake)

**Status:** experimental adapter on a feature branch. Not a deployed ChatGPT sync, production importer, or approval of imported information.

## Reuse: one platform, one memory layer

Reuse KnowledgeAtlasPage.tsx and the existing authenticated supabase/functions/atlas-memory/index.ts endpoint (api=import, max 50 records per request), rather than creating another memory table. The canonical public.atlas_memory_records already offers organization scoping, RLS, source references, and source-hash uniqueness. Existing issue #993 owns chat-ledger governance; PR #411 is the Knowledge foundation.

## Local preparation

1. Download your official ChatGPT data export and extract conversations.json, or use a user-supplied SRT transcript. Keep original files private.
2. Run Node.js with arguments: node scripts/atlas-chat-to-memory.mjs --input /private/conversations.json --out-dir /private/atlas-chat-drafts
3. Inspect manifest.json, skipped entries, provisional classifications, and each atlas-chat-drafts-NNNN.json file. No network request is made during this process. The same input and output directory may be retried safely after interruption: identical batches are reused; any altered existing batch or manifest is rejected without overwriting it. Do not manually edit these generated batches and then retry the same directory; create a separate sanitized intake folder instead.
4. An authorized organization owner/admin may separately submit a reviewed batch to the authenticated atlas-memory?api=import endpoint using approve:false. Never import secrets or irrelevant personal content into organization memory.
5. In Knowledge Atlas, inspect the full text and provisional module mapping of each imported draft. The review panel requires an explicit acknowledgment before enabling approval. It cannot edit or redact an existing draft: if personal or irrelevant content is present, do not approve it. A separate governed redact-and-replace workflow is required before production launch.

The adapter refuses to write private chat output under the current repository, uses restrictive output permissions on POSIX, and never alters originals. On Windows the user should additionally secure the output folder with account ACLs.

## Preservation, boundaries and caveats

- ChatGPT exports: read user/assistant text from the selected branch ending in current_node. System/tool messages and attachment binaries are excluded; inspect older exports with timestamp fallback because branch order may be ambiguous.
- SRT: remove subtitle counters/times while retaining text. Input can be reviewed locally.
- Text is split into 12,000-character segments, grouped into batches of at most 50 records; source references identify conversation and segment, and SHA-256 tracks source content for deduplication.
- All candidates have source_type chat_import, kind note, and sensitivity restricted. Keyword module routing is a suggestion, not a verified fact or a claim of semantic understanding.
- The adapter has no capability to read inaccessible personal ChatGPT chats, to sync the full personal chat history automatically, or to preserve all non-text material.
- Avoid automatically routing personal financial, legal, health or family information to organization modules.

## Illustrative module mapping

| Topics | Canonical module IDs |
| --- | --- |
| ATLAS security, platform, CI/release | cloud, execution, release-control |
| History and religious studies | knowledge, bible-os |
| Medical and biomedical research | health, care |
| Accounting, tax, payments and payroll | accounting, tax, finance, payroll |
| Clients, inventory, business operations | crm, advisory, inventory |
| Media, voice, language learning | studio, voice, learning |
| Phones, networks, remote workspace | device-os, connect, telecom |
| Maps, cities, transportation | gps, city, ride, aviation |
| Unclear or multi-topic chats | knowledge pending manual review |

## ATLAS 777 REVIEW acceptance gates

- [x] Offline adapter, boundary-aware topic routing and regression tests added on feature branch (CI verification pending).
- [x] No network call or automatic approval in the adapter.
- [ ] Verify exact-head CI, code review, and test execution. On original b64205e1, 4/8 Actions workflows failed because the SRT test routed \"first\" as IRS/tax; fixes require a new complete exact-head run.
- [ ] Prove authenticated import, RBAC/RLS tenant isolation, and unauthorized negative cases in staging.
- [x] Add idempotent local generation and mismatch detection; enforce API batch-size validation and preflight, and prohibit automatic chat-import approval.
- [ ] Harden server-side audit-write failure recovery, transactional partial-batch idempotency and concurrent approval. The current server insert-then-audit sequence remains non-atomic; local recovery does not fix this.
- [ ] Govern sensitive-data retention, redaction, erasure and revocation.
- [x] Add explicit full-text review and privacy-acknowledgment gate to the existing Knowledge Atlas draft cards (not yet verified end-to-end).
- [ ] Complete source-filtered import queue, safe redaction/edit/replacement workflow and durable incremental organization import; UI preview alone is not a complete intake interface.
- [ ] Verify production deployment, exact-SHA and end-to-end routes.

**P0 NO-GO:** no merge, deploy or production-completion claim until security, integration and release evidence is verified.

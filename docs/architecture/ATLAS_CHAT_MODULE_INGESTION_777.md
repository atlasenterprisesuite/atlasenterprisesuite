# ATLAS 777 REVIEW — Chat conversations to canonical modules (offline intake)

**Status:** experimental adapter on a feature branch. Not a deployed ChatGPT sync, production importer, or approval of imported information.

## Reuse: one platform, one memory layer

Reuse KnowledgeAtlasPage.tsx and the existing authenticated supabase/functions/atlas-memory/index.ts endpoint (api=import, max 50 records per request), rather than creating another memory table. The canonical public.atlas_memory_records already offers organization scoping, RLS, source references, and source-hash uniqueness. Existing issue #993 owns chat-ledger governance; PR #411 is the Knowledge foundation.

## Local preparation

1. Download your official ChatGPT data export and extract conversations.json, or use a user-supplied SRT transcript. Keep original files private.
2. Run Node.js with arguments: node scripts/atlas-chat-to-memory.mjs --input /private/conversations.json --out-dir /private/atlas-chat-drafts
3. Inspect manifest.json, skipped entries, provisional classifications, and each atlas-chat-drafts-NNNN.json file. No network request is made during this process.
4. An authorized organization owner/admin may separately submit a reviewed batch to the authenticated atlas-memory?api=import endpoint using approve:false. Never import secrets or irrelevant personal content into organization memory.
5. In Knowledge Atlas, redact/review proposed knowledge, verify provenance, and approve individual records only after review.

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

- [x] Offline adapter and regression tests proposed on feature branch.
- [x] No network call or automatic approval in the adapter.
- [ ] Verify exact-head CI, code review, and test execution.
- [ ] Prove authenticated import, RBAC/RLS tenant isolation, and unauthorized negative cases in staging.
- [ ] Harden existing audit-write failure recovery, partial-batch idempotency and transactional approval concurrency. Current insert-then-audit sequence is not atomic.
- [ ] Govern sensitive-data retention, redaction, erasure and revocation.
- [ ] Complete user-facing import/review UX and durable incremental import queue.
- [ ] Verify production deployment, exact-SHA and end-to-end routes.

**P0 NO-GO:** no merge, deploy or production-completion claim until security, integration and release evidence is verified.

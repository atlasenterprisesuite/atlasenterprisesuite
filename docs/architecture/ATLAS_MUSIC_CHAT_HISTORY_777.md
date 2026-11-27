# ATLAS Music Universe 777 — Music Chat History and Knowledge

**Scope:** Reuse the existing `/studio/mix` screen, `packages/creator/audio`, and Knowledge Atlas (`/knowledge`) instead of introducing a new database, agent or provider.

## Ownership, provenance and truthfulness

- This change does **not** claim the ChatGPT account's complete historical conversations have been retrieved.
- The complete personal history requires a user-supplied official `conversations.json` export (or a supported owner-authorized export source). ChatGPT personal memory and chat summaries are not a complete archival data source.
- The user selects a JSON file locally. The browser extracts **only** source conversation identifiers, shortened titles, approximate matching-message counts and topic categories.
- Message text, attachment bytes, audio, video, images, credentials and lyrics are not returned by the classifier or transmitted during preview. Do not index system/tool content.
- The file is not saved, uploaded, logged or sent to a public GitHub repository. Its local preview can be cleared.
- A user-triggered **Save restricted draft** operation sends only classified metadata through the existing authenticated `createAtlasMemoryDraft` API with `source_type=chat_import`, a stable source identifier, `sensitivity=restricted`, modules `studio` and `knowledge`.
- Existing Knowledge Atlas RBAC, tenant membership, audit, source de-duplication, draft lifecycle, and explicit approval remain authoritative. The client never marks a draft approved or fabricates persistence.
- Restricted drafts can only be saved by authorized owner/admin roles. Users without the required role see the server rejection; there is no organization-scoped fallback.
- Bulk import is bounded to 20 successful draft creation calls per explicit click; partial saves are counted, failures stop the batch. Cross-session source collision results remain server-authoritative.

## Music knowledge taxonomy (Spanish and English)

| Topic | Intended research domains |
| --- | --- |
| `songs` | Songs, albums, chronology, public titles and release provenance |
| `artists` | Performers, producers, collaborations, discographies |
| `lyrics` | Meaning, summarized interpretation, vocabulary, language-learning prompts; no copyrighted lyric reproduction |
| `symbolism` | Musical narratives, video iconography, historical and cultural interpretations |
| `composition` | Original songs, notes, tonal key, chords, tempo, MIDI and production |
| `sound-design` | Synths, mixing, instrumentation, ambient audio, binaural and reference frequencies |
| `playlists` | Authorized catalogs, track metadata, sequencing and 45-minute playlist/session manifests |
| `music-video` | Visual-story analysis, evidence frames, temporal references and direction |
| `learning` | Pronunciation, language learning and music literacy |

A future authorized semantic-enrichment phase may link work to public research or ATLAS-owned audio assets. It must preserve source-level rights, dated citations, opt-in, uncertainty, and manual correction. Titles and classifications alone are not proof of factual claims.

## Acceptance / ATLAS 777 REVIEW

- P0: No automatic collection or streaming access to the ChatGPT personal conversation archive.
- P0: The preview never uploads raw messages, lyrics, credentials, or attachments.
- P0: System/tool messages cannot create a music match or leak their content.
- P0: Imported records are organization-scoped **restricted drafts**, never auto-approved or public.
- P0: Unknown JSON structures and ZIPs fail closed. Truncation must be visible.
- P0: Tests prove local filtering and explicit draft save payload.
- P0: Exact HEAD SHA CI, build, responsive accessibility and production route checks required before release.
- P1: Add first-party, source-cited semantic indexing and authorized archival import for full conversations, after privacy threat modeling.
- P1: Extend classification to other languages, media metadata and large exports with streaming verification.

**Status:** source-code implementation in draft PR; full historical ChatGPT archive, end-to-end persistence and production validation are **not completed**.

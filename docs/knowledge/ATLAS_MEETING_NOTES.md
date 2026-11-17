# ATLAS meeting notes

## Purpose

`/knowledge/meeting-notes` provides a meeting-note workspace under the existing ATLAS identity and organization boundary. Work OS links to it, and saved notes use the existing `atlas-memory` draft API rather than a separate store.

## Current behavior

- Manual notes and a pasted authorized transcript stay in page state until sent or saved. Closing or reloading can discard unsaved text.
- Dictation uses the existing single-turn browser speech recognition capability. The user must acknowledge permission to capture participants' voices before starting it. The browser or its recognition provider may process voice; the active microphone has an explicit stop control. Recognition is not necessarily available on every browser or device.
- AI summary, suggested next steps and questions require explicit user consent. The client checks current authenticated provider readiness, organization storage and zero-cost policy, then selects a verified eligible provider by name. The gateway reauthorizes and applies its own cost policy. The submitted text is stored in ATLAS Assistant conversation history and processed by the selected provider. Results are editable drafts and need review.
- Saving explicitly creates a new organization memory draft tagged `meeting-notes`. The user acknowledges visibility; restricted notes are accessible to organization owners/admins and cannot be created by other roles. Organization-visible notes may be accessed by authorized organization members. The client retains the text if the save fails. Since the existing server inserts before writing its audit record, a failure can leave an unconfirmed record; check Knowledge Atlas before retrying.
- Saved meeting notes can be loaded and read through the existing role-scoped memory listing. Other Work notes are filtered from the view. No approval, task execution or external message is performed automatically.

## Limits and release gates

This is not a direct Zoom integration or a continuous meeting transcription service. It does not capture another application's system audio, identify speakers, establish participants' consent, provide personal-only storage, edit/delete existing records, or implement a new retention policy. Confirm speech behavior on each supported device, provider availability, account and role isolation, and production persistence before claiming those capabilities. The current browser recognition uses a Spanish voice turn; manual text can be entered in any language.

Local focused tests use mocked API/recognition boundaries. A passing build or mocked test does not establish live provider readiness, actual backend behavior, cross-device sync, accessibility conformance, a completed production deployment, or exact-SHA verification.

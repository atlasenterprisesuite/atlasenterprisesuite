# ATLAS Director local editing

ATLAS extends its existing Studio Video Lab rather than integrating an OpenArt subscription. The local command editor previews explicit Spanish and English edits before applying them through the existing Director reducer. It requires write permission and disables edits during save/submission. Saving, authorization, tenant scoping, auditing and render readiness remain on the existing API paths.

Supported commands: `Title/Título`, `Brief/Idea`, `Format/Formato`, `Narration/Narración`, `Scene/Escena: description | seconds`, and `Mode/Modo: local`. Scene appends must fit inside the production duration; they preserve existing scenes, references and production identity. Narration replaces the current dialogue; previews disclose that replacement. Formats do not rescale an existing Motion Designer canvas. Unsupported requests return an actionable explanation without changing the draft.

The editor is deterministic: no hosted model, API key, external media generation, publication or automatic paid fallback. It is not an unrestricted AI chatbot or equivalent to OpenArt cinematic generation. Reuse existing subject/environment references and Motion Designer assets first. Native rendering still requires a verified, available runtime and the existing saved-version, validation and generate-permission gates.

“No external generation fee” describes the native path, not free infrastructure. Compute, power and storage may cost money. Existing local narration, captions and motion capabilities are not advertised as ready unless the runtime reports them. No new billing provider, database, route or model dependency is introduced.

Validation covers immutable edits, bilingual grammar, invalid requests, timeline overflow, explicit external-provider deselection, UI preview-before-apply and write-permission denial. Production completion additionally requires CI, canonical merge, Cloudflare deployment and public verification of the deployed revision.

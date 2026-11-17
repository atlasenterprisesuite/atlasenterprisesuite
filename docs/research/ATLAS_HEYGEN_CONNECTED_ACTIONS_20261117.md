# HeyGen app operation inventory — ATLAS research only

Audit date: 2026-11-17. Source: the HeyGen actions exposed to this authorized ChatGPT session.

**121 distinct action names inventoried; 11 functional buckets.**

Important boundaries:
- This is a list of *exposed connector actions*, not a catalog of HeyGen's private source code, internal infrastructure, or independently implemented ATLAS capabilities.
- Some actions are UI-only, read-only, subscription/support, destructive, or can incur generation credits. API availability, prices, rights and workspace scope vary.
- ATLAS has NOT copied these endpoints wholesale or connected its own billing credentials. The ATLAS Video Universe first-party workflows are independently authored and remain planning-only until the appropriate backend adapter is verified.
- Consent and voice/likeness ownership must be established at the provider before creating private avatars or synthetic voice.
- Existing media can be inspected only through the owner's authorized account; never embed signed playback URLs, media files or API keys in public source.

Official developer reference: https://developers.heygen.com/

## 01. Avatar identity, training and consent (27)

- `create_avatar_consent`
- `create_avatar_looks`
- `create_digital_twin`
- `create_look_pack_looks`
- `create_look_remix`
- `create_photo_avatar`
- `create_prompt_avatar`
- `create_template_looks`
- `create_video_from_avatar`
- `create_video_from_cinematic_avatar`
- `delete_avatar_group`
- `delete_avatar_look`
- `get_avatar_creation_status`
- `get_avatar_group`
- `get_avatar_look`
- `get_look_remix`
- `list_avatar_groups`
- `list_avatar_looks`
- `list_avatars`
- `list_look_templates`
- `lookup_videos`
- `open_avatar_creator`
- `prepare_avatar_video`
- `show_avatar_looks`
- `show_avatars`
- `update_avatar_group`
- `update_avatar_look`

## 02. Voices and speech (11)

- `choose_voice`
- `clone_voice`
- `convert_speech`
- `create_professional_voice`
- `create_speech`
- `create_speech_without_player`
- `delete_voice`
- `design_voice`
- `get_video_voice_capabilities`
- `get_voice`
- `list_voices`

## 03. Translation and localization (9)

- `bulk_video_translation_statuses`
- `create_video_translation`
- `create_video_translation_batch`
- `delete_video_translation`
- `get_video_translation`
- `get_video_translation_batch`
- `list_video_translation_languages`
- `list_video_translations`
- `update_video_translation`

## 04. Lip synchronization (8)

- `bulk_lipsync_statuses`
- `create_lipsync`
- `create_lipsync_batch`
- `delete_lipsync`
- `get_lipsync`
- `get_lipsync_batch`
- `list_lipsyncs`
- `update_lipsync`

## 05. Brand identity and terminology (10)

- `create_brand_glossary`
- `create_brand_kit`
- `delete_brand_glossary`
- `delete_brand_kit`
- `get_brand_glossary`
- `get_brand_kit`
- `list_brand_glossaries`
- `list_brand_kits`
- `update_brand_glossary`
- `update_brand_kit`

## 06. Reusable templates (7)

- `create_template`
- `delete_template`
- `generate_from_template`
- `get_template`
- `list_templates`
- `set_template_variables`
- `update_template`

## 07. Post-production transforms (8)

- `create_ai_clipping`
- `create_background_removal`
- `create_filler_word_removal`
- `delete_ai_clipping`
- `get_ai_clipping`
- `get_background_removal`
- `get_filler_word_removal`
- `list_ai_clipping`

## 08. AI directing and conversation (8)

- `create_conversation_video`
- `get_video_agent_resource`
- `get_video_agent_session`
- `list_video_agent_session_videos`
- `list_video_agent_sessions`
- `list_video_agent_styles`
- `stop_video_agent_session`
- `video_agent_generate`

## 09. Video creation, jobs and inspection (14)

- `bulk_video_statuses`
- `create_video_batch`
- `create_video_from_image`
- `create_video_from_studio`
- `delete_video`
- `get_model_video`
- `get_video`
- `get_video_batch`
- `get_video_scenes`
- `image_to_video`
- `list_videos`
- `reference_to_video`
- `show_video`
- `text_to_video`

## 10. Assets, folders and images (13)

- `bulk_asset_statuses`
- `complete_asset_batch`
- `create_asset_upload_batch`
- `create_folder`
- `create_image`
- `delete_asset`
- `get_asset`
- `get_asset_batch`
- `get_folder`
- `get_image`
- `import_asset_from_chat`
- `open_asset_library`
- `search_audio_sounds`

## 11. Workspace, support and remaining actions (6)

- `cancel_subscription`
- `continue_subscription_cancellation`
- `get_current_user`
- `submit_feedback`
- `track_skill_activation`
- `track_skill_completion`

## Proposed ATLAS adapter milestones

1. Read-only discovery: provider account, avatar groups/looks, voices, brand systems, templates, existing videos with tenant filtering.
2. Protected generation: draft compilation, verified subject consent, authenticated API v3, budget preapproval, durable queue and idempotency.
3. Production workflows: speech, avatar video, Video Agent, translation, lip sync, clipping and caption assets.
4. Enterprise release: signed webhooks, provenance and RLS-backed Creator Library, moderation/disclosure, retries, QC, retention and removal.

Do not classify an operation as available in ATLAS merely because it appears in this inventory.

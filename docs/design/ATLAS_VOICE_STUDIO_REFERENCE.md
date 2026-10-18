# Voice Studio reference implementation

Route: `/voice/studio`. The approved October 6 reference is implemented as live controls, not a static screen.

Visual acceptance: midnight background, champagne accents, dedicated studio navigation, visible Voice Studio heading, ES/EN switch, two-column voice stage and script editor, bilingual three-card audio library below the editor. On small screens navigation becomes a horizontal row, the stage/editor stack, and audio cards stack. Reduced motion and high contrast follow the existing accessibility profile.

The approved illustration is reused only in decorative SVG viewports (wave artwork and three cover artworks). Text, fields, buttons, sliders, links, status, playback and downloads are HTML with actual behavior. The full reference is kept as the source asset for those decorative crops. No UI controls come from the image.

Six public, generic onboarding MP3s were generated through the authenticated ATLAS production ElevenLabs adapter on October 6: welcome, navigation and help in Spanish and English. Provider George, model `eleven_multilingual_v2`. They contain no organization records or personal information. Original audio files are reused without resynthesis. Library durations are rounded from verified MP3 metadata; player timeline reads loaded media metadata.

The existing Voice Assistant remains available below the studio and through the local navigation. Personal Voice and accessibility routes remain functional. Generation continues through the existing authenticated, tenant-aware, audited adapter, retaining loading, unavailable, error and success states. The language switch changes interface copy, not the user's script. George is currently the fixed provider voice, so no nonfunctional voice selector is offered.

A visual reference is an implementation target. Completion requires a screenshot of the deployed route compared with its reference, not another generated mockup. Changes to functional or visual details must be reported explicitly rather than presented as an identical result.

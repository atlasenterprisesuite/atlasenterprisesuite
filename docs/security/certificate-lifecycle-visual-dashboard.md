# Certificate Lifecycle visual dashboard — design acceptance criteria

Reference: user-approved ATLAS blue cyber-security infographic generated 2026-10-09 (image must be imported as a versioned project asset before pixel-exact rendering).

Route proposal: /security/certificates (confirm existing router/nav conventions before integration).

Visual structure: dark navy responsive layout; ATLAS identity and globe/shield hero; zero trust, fail-closed, 777 REVIEW and compliance principles; Salesforce certificate policy cards; six-stage execution pipeline; module integrations; verified GitHub/deployment status.

Implementation requirements:
- Preserve the approved image as optional hero artwork, but render all text, stages, indicators and links as accessible HTML/React, not text baked into an image.
- Desktop wide dashboard, tablet stacked panels, mobile one-column layout; keyboard focus, semantic headings, alt text, reduced-motion, high contrast and scalable fonts.
- Do not hardcode the infographic's fictional statuses, dates, progress or compliance claims. Pull from authenticated backend or show NOT VERIFIED.
- Certificate inventory: issuer, purpose, SAN, validity, owner, trust policy, mTLS handshake status, rotation deadline; never expose secrets/private keys.
- Controls: view details, filter risk, initiate authorized test, inspect audit evidence; any write action gated by permission and confirmation where operationally critical.
- Links to GitHub PR #730 and evidence only when actual data is available.
- Automated tests: responsive snapshots, keyboard navigation, no fabricated success badges, safe API error states.
- Fail closed: unavailable telemetry must display UNKNOWN, not HEALTHY.

Status: DESIGN SPEC ONLY. Not implemented, tested, merged or deployed. Do not claim that route exists.

# ATLAS Enterprise Suite

This repository is the new application foundation for ATLAS Enterprise Suite.

The first implemented module is **ATLAS Site Review Center**, a website review workspace that combines pinned visual feedback, issue workflow management, role-based capabilities, deterministic HTML auditing, and truthful integration states.

## Current module

Route: `/sites/review`

Implemented foundation capabilities:

- Create review sessions for HTTP/HTTPS website URLs.
- Desktop, tablet, and mobile review modes.
- Coordinate-based visual review pins.
- Severity and workflow states.
- Assignment and threaded replies.
- Status and severity filters.
- Central role-to-capability mapping.
- Deterministic HTML checks for HTTPS, title, meta description, canonical, viewport, H1 count, image alt attributes, empty links, robots meta, and Open Graph metadata.
- Explicit `not_configured` results for checks that require Search Console, Lighthouse/field data, live response headers, or live crawling.
- JSON export built from actual review data.
- Responsive ATLAS interface.
- Zero runtime dependencies in the initial foundation.

## Local development

Requires Node.js 22 or newer.

```bash
npm test
npm start
```

Open:

```text
http://localhost:4173/sites/review
```

## Verification

```bash
node --check src/app.js
node --check server.mjs
npm test
```

GitHub Actions runs the same syntax checks and test suite on feature-branch pushes and pull requests into `main`.

## Security and truthfulness

- `.env` files are excluded from source control.
- The application does not embed API keys or provider credentials.
- Role preview in the current browser foundation demonstrates the centralized permission model; it is not a claim of production authentication.
- External websites may block iframe embedding through their own browser security policy.
- Live crawling, Search Console, Lighthouse/Core Web Vitals, and production persistence are not reported as connected until authorized integrations are configured.
- No fabricated production metrics are shown.

## Architecture

Design specification:

`docs/superpowers/specs/2026-09-03-site-review-center-design.md`

Implementation plan:

`docs/superpowers/plans/2026-09-03-site-review-center.md`

## Repository policy

Feature development occurs outside `main` and must be verified before merge. Production deployment is a separate step and must not be claimed without deployment evidence.

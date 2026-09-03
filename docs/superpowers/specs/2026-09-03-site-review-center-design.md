# ATLAS Site Review Center — Design Specification

## Purpose

Build the first production-oriented module in the new `atlasenterprisesuite/atlasenterprisesuite` repository: **ATLAS Site Review Center**. It combines visual website feedback workflows with technical website auditing while establishing a reusable ATLAS application foundation.

## Product ownership

- Primary module: **ATLAS Sites**
- Secondary integrations: ATLAS Projects, Analytics, Security, Developer Center
- Initial route: `/sites/review`

## Functional scope

### Review workspace
- Accept a website URL or a locally managed ATLAS site target.
- Provide desktop, tablet, and mobile review modes.
- Allow reviewers to add pinned comments anchored to coordinates on the reviewed page canvas.
- Support threaded replies.
- Support issue status: `open`, `in_progress`, `resolved`, `rejected`.
- Support severity: `critical`, `high`, `medium`, `low`.
- Support assignment to a responsible user identifier.
- Support filtering by status, severity, viewport, and assignee.
- Support resolving and reopening issues.
- Preserve review session history.

### Technical audit
Initial deterministic checks must work without external APIs:
- HTTPS usage.
- Presence of page title.
- Presence of meta description.
- Presence of canonical URL.
- Presence of viewport meta.
- Presence/count of H1 headings.
- Missing image alt text.
- Empty links.
- Presence of robots meta.
- Presence of Open Graph title/description when provided in inspected markup.

Checks that require external providers, browser automation, Search Console, Lighthouse, or production infrastructure must surface a truthful `not_configured` state rather than invented scores.

### Reporting
- Generate category summaries from actual detected issues.
- Never invent metrics.
- Export review/audit data as JSON in the initial foundation.
- PDF/CSV may be added after the underlying export model is stable.

## ATLAS foundation

This repository starts effectively empty, so the first implementation must establish a minimal reusable platform rather than a one-off page.

### Runtime
- Browser-native frontend with ES modules.
- Node.js built-in test runner for domain logic.
- Zero runtime dependencies for the first foundation so the repository can be tested without package installation.

### Structure

```text
src/
  index.html
  app.js
  styles.css
  core/
    routes.js
    permissions.js
  modules/
    site-review/
      review-store.js
      review-service.js
      audit-engine.js
      site-review-ui.js

tests/
  review-store.test.mjs
  review-service.test.mjs
  audit-engine.test.mjs
```

### Data boundaries

The initial browser implementation uses an in-memory store with optional localStorage persistence behind a store interface. The domain model must not be coupled to a specific future backend. A later production adapter can replace persistence with Supabase/ATLAS APIs without rewriting review logic.

### Domain model

`ReviewSession`
- `id: string`
- `siteUrl: string`
- `title: string`
- `createdAt: string`
- `updatedAt: string`
- `status: 'active' | 'archived'`

`ReviewIssue`
- `id: string`
- `sessionId: string`
- `pageUrl: string`
- `viewport: 'desktop' | 'tablet' | 'mobile'`
- `x: number` normalized 0..1
- `y: number` normalized 0..1
- `message: string`
- `status: 'open' | 'in_progress' | 'resolved' | 'rejected'`
- `severity: 'critical' | 'high' | 'medium' | 'low'`
- `assigneeId: string | null`
- `createdBy: string`
- `createdAt: string`
- `updatedAt: string`

`ReviewReply`
- `id: string`
- `issueId: string`
- `message: string`
- `createdBy: string`
- `createdAt: string`

`AuditFinding`
- `id: string`
- `ruleId: string`
- `category: 'seo' | 'accessibility' | 'security' | 'content' | 'performance'`
- `severity: 'critical' | 'high' | 'medium' | 'low' | 'info'`
- `status: 'detected' | 'passed' | 'not_configured'`
- `message: string`

## Security and permissions

The foundation includes explicit permission checks even before authentication is connected.

Roles:
- `owner`
- `admin`
- `developer`
- `designer`
- `reviewer`
- `client`

Capabilities:
- `review.read`
- `review.comment`
- `review.assign`
- `review.resolve`
- `review.archive`
- `audit.run`
- `audit.export`

Permissions must be centrally mapped and tested. UI controls must respect the capability model rather than hiding rules inside components.

## UI design

The interface follows ATLAS dark enterprise styling and must be responsive.

Desktop:
- Left ATLAS navigation rail.
- Top context bar with site URL and viewport controls.
- Center review canvas.
- Right review/audit panel.

Tablet/mobile:
- Collapsible navigation.
- Canvas first.
- Review panel becomes a drawer or stacked section.

Required states:
- loading
- empty
- active
- selected
- resolved
- error
- permission denied
- not configured

## Error handling

- Invalid URLs return validation errors without creating sessions.
- Invalid issue coordinates are rejected.
- Invalid enum values are rejected.
- Missing sessions/issues return typed domain errors.
- Audit parser errors return a deterministic error result rather than synthetic findings.

## Testing

Use Node.js `node:test` and `node:assert/strict`.

Required test coverage for foundation:
- session creation and URL validation
- issue creation and normalized coordinates
- issue status transitions
- threaded replies
- issue filtering
- permission capabilities
- deterministic audit findings
- truthful `not_configured` findings for provider-dependent checks

## Delivery constraints

- No copied Wix source code, proprietary UI assets, or proprietary backend behavior.
- No fake production connectivity.
- No fabricated scores or data.
- No deployment claim without actual deployment evidence.
- No merge to `main` until tests are verified.
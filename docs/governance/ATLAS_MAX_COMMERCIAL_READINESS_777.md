# ATLAS MAX — Commercial Use and Customer Demonstration Readiness

Date: 2026-11-06
Owner: ATLAS 777 REVIEW
Scope: `/max` and PR #1011 only.
Decision: **P0 NO-GO** for customer sale, paid activation, or production certification pending evidence below.

## Evidence model

**Code compiling does not establish a commercial-use license.** A browser test using a synthetic ATLAS identity does not establish production authentication. This record distinguishes those categories and does not constitute legal advice or an authorized business attestation.

### Direct scope inventory

| Surface | Evidence | Status |
| --- | --- | --- |
| MAX UI source | `apps/web/src/modules/atlas-max/` React/CSS, using canonical `apps/web/src/atlas-design-tokens.css`; no copied ChatGPT logo, trade dress or OpenAI visual asset introduced in the PR | Code-level inspection only |
| ATLAS module branding | First-party product naming/design used by MAX; historical project ownership/assignments must be substantiated by the authorized owner | Ownership evidence needed |
| Dependencies | React/Vite/Vitest and browser test packages are external software; `package-lock.json` identifies runtime versions but license obligations and redistribution notices need an SBOM/license audit | License audit required |
| Fonts and graphics | MAX's visual composition uses CSS, text and ATLAS tokens; no new third-party image or font file is added by this PR | Source inventory only; whole-site assets not certified |
| Provider APIs | Actual execution remains on the existing Intelligence Gateway with server-side adapters and tenant policy; a consumer ChatGPT Pro subscription is **not** an ATLAS API or resale entitlement | Provider contracts and permitted usage need verification |
| Privacy and customer information | Browser E2E stubs a synthetic organization; no production customer data, recordings or credentials are used | Actual privacy notices, data processing terms, retention and consent still need approval |
| Plan pricing/entitlement | `/max` returns `unknown` for MAX plan and no commercial quotas; it cannot grant billing or operator rights from the frontend | Server authority and commercial launch gate missing |
| Billing/tax/support | No audited MAX checkout, subscription ledger, merchant/tax terms or refund/support commitments validated in PR #1011 | Commercial operations not approved |
| Production version | Branch is Draft; no release / deployed SHA attestation | Not deployed |

### External source boundaries

- OpenAI brand and model references: https://openai.com/brand/ — never imply endorsement or use OpenAI/ChatGPT/GPT marks as ATLAS-owned branding.
- Applicable OpenAI service terms (2026-10-16): https://openai.com/policies/service-terms/
- OpenAI Services Agreement: https://openai.com/policies/services-agreement/
- Independently audit **all** vendor terms, dependency licenses and user data rights for deployed services. Do not infer permission from technical connectivity or an existing ChatGPT plan.

## Fail-closed demo and sale policy

1. `public product explainer` may describe planned architecture using truthful statuses and original assets.
2. `isolated engineering demonstration` may use only synthetic tenant fixtures and disabled production actions; identify it as a demonstration.
3. `private customer pilot` requires authorized tenant account, signed access/data agreements as appropriate, model/provider terms, actual server entitlements and metering, real-role/RLS negative tests, privacy and security review, verified runtime.
4. `commercial availability` additionally requires owner-verified IP rights, dependency license obligations/notices, commerce terms, subscription/billing authority, customer support obligations, production exact-SHA certification, and release sign-off.
5. No user data, tenant, API key, production entitlement, paid capacity, or licensing proof may be fabricated to satisfy any gate.

## Reproducible technical evidence

- Isolated browser script: `tests/browser/atlas-max-authenticated.mjs`, with intercepted Supabase origin and synthetic fixture.
- Full-route integration: `tests/integration/atlas-max-authenticated-route.test.tsx`.
- CI workflow: `.github/workflows/atlas-max-authenticated-browser.yml`.
- Chrome/Axe coverage: 320px, 768px and 1440px; route guard, membership rejection, scoped API output, refresh and negative cross-organization response.
- Browser E2E is **not** real-service account testing, and the corresponding artifact is **not** a production screenshot.

## Evidence required for release sign-off

- [ ] Signed/authorized chain-of-title and permitted commercial usage of ATLAS UI/brand/assets
- [ ] Dependency SBOM, attributable third-party license/notice verification and obligations
- [ ] Vendor API/business terms and platform access rights verified for each enabled provider
- [ ] Tenant-consent/data-protection review and customer contract/pricing/billing controls
- [ ] Backend-authenticated entitlement and quota/usage source; no client-supplied grants
- [ ] Real authenticated E2E on a **non-production** authorized test tenant, including RLS/RBAC and revocation
- [ ] Dedicated /max browser+Axe CI (isolated test), manual keyboard/screen reader checks and responsive visual approval
- [ ] Independent security/design review and PR/Ruleset required checks for exact SHA
- [ ] Authorized merge, deployment, post-deploy critical path and exact SHA verification

Until each P0 has an evidence reference, the product is **not** commercially certified. A P1 warning must never silently downgrade a P0.

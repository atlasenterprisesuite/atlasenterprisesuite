# TRUST-0001 — Cider Casino (Florida) | ATLAS Trust Intelligence

**Case ID:** TRUST-0001  
**Date:** 2026-10-17  
**Case status:** DOCUMENTED / UNVERIFIED REGULATORY STATUS; NOT A PRODUCTION FEATURE  
**Classification:** External commercial-platform due diligence, not a legal opinion.  
**Jurisdiction:** Florida, United States  
**Subject:** Cider Casino – Real Money; App Store ID `6744304405`

## 1. Executive finding

The Apple listing identifies **Mystic Mirror Studio Limited** as the developer/seller. The published Cider Casino Sweeps Rules (version 12.6, dated 2026-07-20) identify **Relaxing Moonlight Games Inc** as the sweepstakes sponsor. The rules describe a promotional Sweeps Coins system and include Florida among jurisdictions *not expressly excluded* in the eligibility section. **This does not establish that the platform is licensed, legally authorized, or compliant in Florida.** A regulator-specific authorization, applicable legal analysis, and an independent payout audit were not established by this source review.

**Decision:** Regulatory authorization **UNVERIFIED**. No safe-to-deposit or guaranteed-payout recommendation. No allegations of fraud inferred from user reviews. Case is not a social/person trust score.

## 2. Evidence matrix

Status meanings: **DOCUMENTED** = exact published source supports the claim but does not independently validate operator conduct; **UNVERIFIED** = independent proof missing; **REQUIRES RECHECK** = time-dependent or incomplete. Do not treat a source declaration as legal certification.

| ID | Claim / control | Evidence URL | Source class | Finding | Status |
|---|---|---|---|---|---|
| E01 | iOS app identity | https://apps.apple.com/us/app/cider-casino-real-money/id6744304405 | Apple first-party listing | Name, category and seller Mystic Mirror Studio Limited; 18+; in-app purchases | DOCUMENTED |
| E02 | Sponsor identity | https://www.cidercasino.com/sr.html | Operator-published rules §1 | Relaxing Moonlight Games Inc, declared Denver address | DOCUMENTED (self-attested) |
| E03 | Eligibility in Florida | https://www.cidercasino.com/sr.html | Operator-published rules §2 | Florida not expressly excluded; 'void where prohibited' and applicable-law qualifications | DOCUMENTED; LEGALITY UNVERIFIED |
| E04 | Free-entry mechanism | https://www.cidercasino.com/sr.html | Operator-published rules §6 | Daily, promotion and mail-in options are described; fulfillment not independently tested | DOCUMENTED (self-attested) |
| E05 | Cash redemption threshold | https://www.cidercasino.com/sr.html | Operator-published rules §9 | Minimum US$100 in eligible Sweeps Coins | DOCUMENTED |
| E06 | Payment processing | https://www.cidercasino.com/sr.html | Operator-published rules §9 | May take up to 30 days; timeline not guaranteed; enhanced checks at US$500+ | DOCUMENTED |
| E07 | Frequency and caps | https://www.cidercasino.com/sr.html | Operator-published rules §9 | One redemption request per day; discretionary US$10,000/day cap | DOCUMENTED |
| E08 | Identity and privacy | https://www.cidercasino.com/sr.html ; https://apps.apple.com/us/app/cider-casino-real-money/id6744304405 | Rules §8; Apple privacy declaration | KYC may request ID, SSN, facial verification; Apple warns privacy declarations not Apple-verified | DOCUMENTED policy, operational controls UNVERIFIED |
| E09 | Prize eligibility | https://www.cidercasino.com/sr.html | Operator-published rules §7 | Promotional coins may require one play and up to 20x playthrough | DOCUMENTED |
| E10 | Florida gambling authorization | https://flgaming.gov/ | State regulator | No regulator-issued Cider-specific license or formal legality determination attached to this case | UNVERIFIED; P0 for affirmative safety certification |
| E11 | Independent payouts | https://www.cidercasino.com/sr.html | Operator terms only | No independently audited redemption outcomes, bank confirmations or failure rate | UNVERIFIED |
| E12 | RTP / fairness | https://www.cidercasino.com/sr.html | Operator terms §5 | Game odds described as mutable; no independently audited game-level RTP attached | UNVERIFIED |
| E13 | User reviews | https://apps.apple.com/us/app/cider-casino-real-money/id6744304405 | User-generated reviews | Anecdotes are leads only; no inference of confirmed fraud or confirmed reliable payout | REQUIRES RECHECK |

**Source review limitation:** Sources are publicly accessible URLs, not immutable archival captures. Store retrieval timestamp, fetched document, SHA-256 digest, response metadata and exact supporting passage when an authorized capture worker is implemented. No SHA, crawl timestamp or regulatory certificate is invented here.

## 3. Risk register / severity

| Finding | Severity | Rule | Required closure |
|---|---|---|---|
| No authenticated Florida-specific regulatory authorization or reasoned applicable-law determination | P0 for any 'licensed/safe/legal in Florida' label | Fail closed: display UNVERIFIED rather than positive certification | Regulator record or reviewed jurisdictional legal basis with dated source |
| No independent evidence of payout reliability | P0 for any 'pays reliably/guaranteed' claim | Never infer from ratings or anecdotes | Transaction audit or verifiable independent payout evidence |
| No verified game fairness / RTP | P1 | Clearly label unknown; no win predictions | Approved independently verifiable report |
| Discretionary KYC/processing delays, fees, limits | P1 | Display material contractual restrictions | Current rules rechecked with version |
| Entity ambiguity between seller, sponsor, processor | P1 | Separate declared roles; no ownership inference | Corporate records and contracts reviewed |
| Potential privacy sensitivity of KYC | P1 | Data minimization; do not collect user ID/SSN into case evidence | Privacy impact assessment and approved encrypted handling |

## 4. Reuse-first architecture

Reuse the existing ATLAS canonical identity, tenant/org scope, RBAC, Supabase RLS, Stewardship Governance `docs/governance/ATLAS_STEWARDSHIP_ADOPTION.md`, existing `audit_logs` patterns and canonical release evidence process. Do not create a parallel trust identity, organization registry, permission system, financial ledger, or social score. The read-only investigation module can share evidence provenance patterns from `docs/finance/TRANSACTION_TRUTH_DAY1.md` but must not import its provider-verified financial-event meaning into public web claims.

Proposed bounded domain schema (proposal only): `trust_cases` (org_id, case_id, jurisdiction, subject_key, lifecycle), `trust_sources` (canonical URL, retrieval time, content digest, issuer type, terms version), `trust_findings` (source IDs, assertion, status, confidence rationale, expires_at), `trust_reviews` (reviewer, reason, decision, policy), `trust_audit_events` (existing audit infrastructure binding). Do not create tables until schema and RLS review. Evidence snapshots should be immutable, encrypted where private, and segregated by tenant.

Flow: authenticated case request → normalize subject → authorized source retrieval → immutable evidence + SHA → exact-citation claim extraction → cross-source discrepancy assessment → jurisdiction-specific gate → reviewer approval where needed → case decision + audit trail. All AI output is untrusted and cannot grant licensing status.

## 5. Acceptance criteria (testable)

| ID | Criterion | Test/evidence required | Gate |
|---|---|---|---|
| AC01 | Reuse canonical ATLAS identity/org/RBAC; no duplicate foundation | Architecture diff + permission registry review | P0 |
| AC02 | Per-tenant case isolation | Negative RLS integration tests for cross-tenant list/read/edit, including forged org_id | P0 |
| AC03 | Evidence provenance | Every published finding links to immutable captured source, digest, retrieved_at, URL and exact supporting passage | P0 |
| AC04 | Unknown licensing defaults to UNVERIFIED | Unit tests for absent, stale, contradictory, spoofed licensing sources | P0 |
| AC05 | No misleading payout guarantees or user review inference | Contract and UI assertions + negative tests | P0 |
| AC06 | Authoritative role-based mutations with audit | Allow/deny tests, actor/tenant/purpose/event linkage | P0 |
| AC07 | Privacy/security | Sensitive data is redacted, no secrets in logs, access-reviewed retention and encryption policies | P0 |
| AC08 | Citation integrity & changes | Broken link, changed terms version and SHA mismatch produce stale/review state | P0 |
| AC09 | Usable responsive UI | Keyboard, screen reader, contrast, phone/tablet/desktop E2E tests | P1 |
| AC10 | Source freshness | Configurable expiry and recheck queue; stale evidence never silently certified | P1 |
| AC11 | Audit/export | Downloadable redacted case report, ordered evidence matrix, immutable review history | P1 |
| AC12 | Actual release integrity | CI tests + typecheck + build + code review + main merge + Cloudflare exact-head SHA verification + critical-route smoke test | P0 before PROD |

**TDD test plan:** Build failing fixtures first: Florida non-exclusion must NOT imply licensed; missing regulator proof → UNVERIFIED; fabricated review count → reject; stale terms digest → invalidate; mixed org IDs → deny; cross-tenant access → deny; insufficient KYC source → no collection; claimed payment screenshot → anecdote only; contradictory licensed/unlicensed documents → NEEDS_REVIEW. Then implement the smallest integration using existing modules, run full checks, open reviewed PR, and promote only after exact-SHA checks.

## 6. Release ledger (truthful)

- Discovery: verified presence of existing canonical stewardship, audit and finance-evidence specifications in GitHub.
- Current deliverable: this **research and implementation specification only**.
- Database migration: **NOT CREATED**.
- Frontend/backend functionality: **NOT IMPLEMENTED**.
- Automated tests / CI for this new module: **NOT RUN**.
- Merge / Cloudflare deployment / E2E: **NOT DONE**.
- Case legality/payout certification: **UNVERIFIED**.

Do not change these statuses without attached machine-verifiable evidence from the relevant CI, database, and production environments.

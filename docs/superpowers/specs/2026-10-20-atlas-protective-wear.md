# ATLAS Protective Wear — engineering brief and verification gates (v0.1)

Status: RESEARCH / NOT CERTIFIED / NOT FOR PROTECTIVE DEPLOYMENT
Scope: ATLAS Enterprise Suite → Device OS → Safety / Wearables. Ties to Ride safety workflows only after separately approved integration.
Date: 2026-10-20

## Vision
Discreet modular, inclusive, ergonomic outerwear for delivery, mobility and night-shift users. Separate **preventive safety** (visibility, navigation, emergency response, training) from **impact protection** (certified protective assemblies). Neither software nor fashion design proves protective efficacy.

## Source of truth and reuse
- Extend existing `apps/web/src/modules/device-os/DeviceEvolutionPanel.tsx` rather than create a competing hardware registry or new production route.
- Device OS hardware concepts retain `research-track` state.
- No new vendor, sensor, telemetry, material performance, or certified garment is assumed.
- Reuse ATLAS Identity/Privacy/Connect for future SOS functions; those are OUT OF SCOPE for v0.1.

## Mechanical reference envelope (not a protective recipe)
A jacket/carrier concept with customizable fit and graded sizes, unrestricted shoulder rotation, quick and safe doffing, weather and thermal comfort, removable compartments compatible with the original manufacturer's approved insert carrier instructions, high-contrast or reflective detailing, and labels for traceability and maintenance. No DIY ballistic or stab-resistant inserts; never cut, stitch, puncture, alter, or layer third-party panels without manufacturer instructions and validation. Carrier + insert + wear configuration must be reviewed as the tested assembly before making protection claims.

## Risk assessment and test separation
1. Cut/abrasion: analyze common occupational hazards and select a test method applicable to the exact garment/zone. Cut resistance is not stab or ballistic protection.
2. Stab/puncture: consult NIJ 0115.00 for torso stab-resistant armor (check current corrections/validity); establish target threat category, coverage, fit, and full configuration.
3. Ballistic: consult NIJ 0101.07 plus addenda and NIJ 0123.00 threat classification; validate panel/model via NIJ compliance listing. NIJ 0101.06 products may remain in the prior compliant listing during transition; independently check current listing and product status.
4. Blast, fire, chemical, electrical, head/neck/limb injury, and every uncovered zone are excluded unless separately tested for their own hazard. No universal "bulletproof / knife-proof" label.
5. Fit-testing, don/doff, dynamic movement, visibility, heat stress, washing and service-life assessment are required. Per OSHA PPE principles, workplace hazard assessment comes before selection.

## Evidence ledger requirements
Every candidate must have: manufacturer and product name; exact SKU/model/size; approved carrier/inserts/configuration; standard/version and threat rating; independent source and current listing; dated review by accountable reviewer; coverage diagrams; test/report identifiers; inspection/recall, service life and care instructions. Personal delivery/user location must not enter this ledger.

Model display states:
- Research only: no external data.
- Documentation review: complete apparent external records requiring independent check.
- Verified for approved use: future privileged, auditable external verification ONLY; not represented by current client code.
No self-asserted material data may promote state to approved, and all marketing copy must be gated separately by a qualified compliance review.

## UX acceptance criteria
- Device OS allows switching among Courier, Night Shift, and Everyday Mobility concepts.
- Threat categories are distinct; relevant standards are identified only as research requirements.
- Missing or unreviewed evidence fails closed. No fake scores or "certified" badges.
- Accessible mobile interactions, bilingual design plan, adequate contrast, screen-reader labels, empty states.
- No new permissions, backend tables, location logs or cloud bills during the initial research work.

## 777 REVIEW gates
P0: product cannot claim resistance without traceable verified evidence; tenant/user isolation for any future data; compliance review; physical configuration documentation; CI; no production capability claims; no credentials.
P1: design details including styling/colors, seasonality, future optional sensors and noncritical recommendations.
Acceptance for this PR: model+component+unit tests+Device OS integration+review CI. No deploy declaration without exact-SHA and production checks, and no physical product efficacy declaration without accredited third-party testing.

## Regulatory/technical primary references (consult for latest revisions)
- NIJ ballistic armor: https://nij.ojp.gov/topics/equipment-and-technology/ballistic-resistance-body-armor-nij-standard-010107
- NIJ stab armor: https://nij.ojp.gov/topics/equipment-and-technology/body-armor/stab-resistance-personal-body-armor-nij-standard-011500
- OSHA PPE: https://www.osha.gov/personal-protective-equipment

## Open work
Hazard assessment; select verified candidate products, actual manufacturing/industrial design partner and testing lab; document sizing; lifecycle/maintenance; sample fitting and independent tests; optional SOS integration; physical prototype and validation. Scope is not finished until these gates pass.

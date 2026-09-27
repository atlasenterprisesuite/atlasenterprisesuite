# ATLAS Carrier Numbering Foundation

ATLAS Carrier is the numbering and PSTN identity layer shared by ATLAS Communication and ATLAS Wireless.

## Two production paths

### 1. Partner-backed carrier path

ATLAS owns the product, routing policy, customer experience, tenant model, billing logic, audit, voice AI, CRM integration, and number lifecycle. A licensed upstream carrier supplies regulated PSTN interconnection and number resources.

This is the shortest path to real numbers.

A number is not marked active until the upstream carrier returns authenticated provisioning evidence.

### 2. Direct numbering path

ATLAS obtains direct numbering authority and requests resources itself from the numbering administrator.

ATLAS must not claim this state until the required federal authorization, facilities readiness, numbering administration enrollment, E911 obligations, contribution/reporting obligations, and robocall-mitigation requirements are evidenced.

## Fail-closed numbering states

not_started
→ partner_path OR fcc_application_pending
→ fcc_authorized
→ nanpa_ready

Number resources:

reserved → assigned → active → suspended → released

The direct path may only provision when the authorization is nanpa_ready and the required facilities, E911, and robocall-mitigation gates are true.

The partner path may provision only when an authenticated upstream carrier relationship exists and E911 readiness is verified.

## Area-code policy for ATLAS

Preferred initial markets:

1. 407 — Orlando
2. 689 — Central Florida / Orlando overlay
3. 919 — North Carolina expansion

No complete telephone number may be invented or shown as assigned. ATLAS stores only numbers that are returned by an authorized numbering source.

## Production completion evidence

A real number is production-valid only when all of the following exist:

- E.164 number returned by an authorized numbering source
- provider or numbering-administrator resource ID
- authenticated provisioning evidence
- service assignment
- E911 readiness where required
- successful inbound or outbound test evidence
- audit trail
- current lifecycle state derived from provider evidence

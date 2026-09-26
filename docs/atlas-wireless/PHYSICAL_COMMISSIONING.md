# ATLAS Wireless — Physical Commissioning Runbook

Status: commissioning control plane implemented; physical site evidence must be collected externally.

## First site identifier

Use `ORL-LAB-001` for the first controlled Orlando-area ATLAS Wireless laboratory site.

This identifier does not assert an address, lease, installed radio, active spectrum authority or live service. Location coordinates must only be entered after an authorized physical site is selected.

## Commissioning sequence

A site may progress through:

`planned -> evidence_collection -> validation -> ready_for_approval -> commissioned`

`commissioned` is terminal for the evidence set. Corrections require a new commissioning run or governed superseding evidence; a commissioned run is not silently rewritten.

## Required evidence gates

1. Physical site verified.
2. Radio/small cell commissioned.
3. Spectrum authority/access verified.
4. SAS coordination verified when applicable, or a documented not-applicable determination.
5. ATLAS 5G core reachable.
6. Backhaul operational.
7. Subscriber identity / SIM-eSIM test path ready.
8. Device attach verified.
9. Data session/path verified.
10. Observability and logging verified.
11. Emergency-service/public-service boundary verified.
12. RF safety evidence verified.

Every passed or not-applicable task requires nonblank evidence and a verifier identity/timestamp.

## Approval separation

Evidence collection uses `wireless.network.commissioning.write`.

Final commissioning uses the distinct `wireless.network.commissioning.approve` permission and requires an additional approval evidence reference. Owners/admins receive these permissions; ordinary members do not.

## Truth boundary

A GitHub merge, web route, API response, purchase order, equipment shipment or configuration file does not prove physical commissioning.

The first site becomes physically ✅ only after the commissioning record reaches `commissioned` from authenticated physical evidence. Public commercial service remains a separate regulatory/commercial launch gate even after a lab site is commissioned.

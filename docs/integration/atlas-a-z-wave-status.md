# ATLAS A-Z Integration Wave Status

This file records the integration-wave checkpoint used to trigger verification on the synchronized release tree.

## Accepted waves

- Core + Accounting baseline
- Accounts Payable recovery and truthful runtime assertions
- Bank & Cash + Reconciliation
- Telecom MiFi safe domain contracts (no live forwarding claims)
- Health Research guardrails
- Health Operations governed contracts

## Current candidate

- Spatial entry mounted at `/spatial` inside the existing governed ATLAS shell
- Enterprise home remains at `/`
- Health remains at `/health`
- WebGL experience has reduced-motion / unsupported-WebGL fallback
- No prerecorded interface or fabricated live connections
- `package-lock.json` synchronized by ATLAS Release Bot after Spatial dependencies were added

## Gate policy

This checkpoint is accepted only when Accounts Payable CI, ATLAS Core Accounting CI, ATLAS Health Research CI, and ATLAS Spatial CI all pass on the same release head. `main` remains unchanged until the complete A-Z closure matrix is green.

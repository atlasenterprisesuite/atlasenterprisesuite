# ATLAS Sentinel Shield

ATLAS Sentinel Shield is the defensive endpoint-security product track for ATLAS Enterprise Suite.

The canonical product identifier is `atlas.security.sentinel-shield`. It is intentionally distinct from ATLAS Health Jaque Mate + Sentinel and ATLAS A6 Sentinel. Endpoint-security routes, permissions, evidence, telemetry and release claims must use the security namespace and must never inherit Health or Aviation Sentinel state.

## Protection layers

- real-time file and process inspection
- signed threat-intelligence and reputation
- behavior and anomaly detection
- ransomware protection and protected-folder controls
- web, DNS and network protection
- reversible quarantine, recovery and rollback
- tamper protection and least-privilege enforcement
- offline protection and cryptographically signed updates
- EDR incident timeline, correlation and governed response
- removable-media and download scanning
- supply-chain and package-integrity checks
- performance, resource-use and false-positive telemetry

## Evidence gate

Protection states are fail-closed: `planned`, `implemented`, `tested`, `independently_validated`, `production_verified`.

ATLAS must not display `protected`, `clean`, `blocked`, `production_verified`, or comparative superiority unless the applicable engine and evidence support that state. A UI state must be derived from evidence, never from installation alone.

## Safety invariants

- quarantine is reversible and auditable
- destructive remediation requires explicit governed policy and evidence
- Sentinel Shield must not weaken an existing security control merely to install or operate
- unsigned or stale intelligence cannot be promoted to trusted
- cloud unavailability must not silently disable local protection
- tenant evidence and response actions remain isolated
- comparative marketing claims require reproducible independent validation

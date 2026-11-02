# ATLAS Robotics F8 — Humanoid Engineering recovery / reuse contract

## Evidence from Library (not code execution)
Historical source files discovered:
- atlas_humanoid_engineering_v1.html and v1 README
- atlas_humanoid_engineering_v2.html and v2 README
- atlas_humanoid_server.py (local SQLite/API/static server)
- atlas_humanoid_bom_v2.csv
- ATLAS Digital City: Urban Twin Infographic.png
- ATLAS Digital City Architecture Infographic.png

README v2 claims a local-first planning application with five variants H-B1, H-H1, H-O1, H-I1, H-D1, BOM, inventory, supplier registry, manufacturing orders, serials, 3D STL viewer, simulated telemetry, QA, audit, JSON and CSV export, SQLite/localStorage fallback. These are source-declared features, not certified functionality.

## Reuse matrix
| Historical component | Target ATLAS subsystem | Decision | Required gate |
|---|---|---|---|
| H-Series variants | Robotics Core registry | Adapt | schema, tenancy and product status |
| BOM and supplier records | Inventory / Purchasing | Reuse concepts, not storage | tenant RLS and audited costing |
| Manufacturing and serial registry | Robotics / Work | Adapt | immutable traceability, revocation |
| STL viewer and parametric placeholder | Urban Twin / Device OS | Reuse visual concepts | file parsing security and simulation provenance |
| Telemetry simulator | Robotics simulation | Adapt | deterministic fixtures, no physical I/O |
| Test lab / safety gates | Release Control | Adapt | evidence exact-SHA, independent certification |
| SQLite and browser localStorage | Local Core only | Do not use as multi-tenant authority | secure sync and conflict handling |
| Cost simulator | Finance / Business Analytics | Reuse calculation concepts | reproducible cost basis |

## Mandatory implementation boundaries
1. Do not copy browser/localStorage identities into server authorization.
2. No robot hardware or vehicle control.
3. No claims of certified humanoid production.
4. Maintain a single Robotics Core execution adapter; H-Series variants are data, not separate execution engines.
5. No release until PostgreSQL two-session revocation tests, RLS negative tests, Vitest, typecheck, CI and exact-SHA review pass.

## Immediate next engineering action
Inspect actual v2 HTML, Python server and BOM in full, compare against the canonical repo, then implement a tenant-scoped H-Series catalog in an isolated branch. Keep PostgreSQL authorization P0 NO-GO.

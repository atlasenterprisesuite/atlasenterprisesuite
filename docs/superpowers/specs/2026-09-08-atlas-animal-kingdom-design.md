# ATLAS Animal Kingdom — Design Specification

Status: approved product direction
Date: 2026-09-08
Primary owner: Knowledge Atlas
Secondary integrations: ATLAS Education, ATLAS Health, Analytics
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Production backend authority: Supabase `atlas-core` (`ggmanzcgtlrvqfoccgsh`)

## Purpose

ATLAS Animal Kingdom is the governed zoological knowledge domain inside Knowledge Atlas. It organizes animal taxa from broad groups down to individual species, makes ecological roles and human relevance searchable, and preserves the distinction between scientific evidence and philosophical or religious interpretations of purpose.

The module must never imply that science has proven why an animal was "created". Scientific views are represented as evidence-backed ecological roles, evolutionary history, life history and relationships. A separate interpretation field may describe religious or philosophical perspectives only when explicitly labeled as interpretation rather than scientific fact.

## Product route

Primary route:

`/knowledge/animals`

Species detail:

`/knowledge/animals/:slug`

The route belongs to Knowledge Atlas and is linked from the ATLAS shell and Enterprise home. The first release is read-only discovery and evidence navigation. It must not fabricate species counts, conservation metrics or source status.

## Core information model

Each animal record contains:

- stable id and slug;
- accepted scientific name;
- common names;
- rank;
- taxonomy path;
- broad ATLAS animal group;
- habitat summary;
- diet summary;
- reproduction summary;
- ecological roles;
- human relationship / benefits;
- risks or nuisance information;
- conservation status when a reliable source is actually present;
- medical relevance when supported;
- evidence sources;
- review date and evidence state.

Each source record contains:

- title;
- organization / publisher;
- URL or stable identifier;
- source type;
- claim scope;
- retrieval or review date.

## Scientific truth boundary

The module uses these evidence states:

- `verified_source`: supported by an authoritative or primary institutional source;
- `curated_reference`: supported by a reputable taxonomic or educational reference;
- `needs_review`: stored but not shown as settled fact until reviewed.

The UI must visibly identify source-backed content and provide outbound source links. Unsupported folklore, viral claims and myths must not be presented as fact. When a common myth matters, the record may contain a myth correction with a supporting source.

## First governed dataset

The first seed establishes the taxonomy/data contract rather than pretending to contain all animal species. It includes representative taxa across major animal groups and specifically includes the lovebug that initiated this domain:

- Common lovebug — `Plecia nearctica` — Insecta;
- African bush elephant — `Loxodonta africana` — Mammalia;
- Ruby-throated hummingbird — `Archilochus colubris` — Aves;
- American alligator — `Alligator mississippiensis` — Reptilia;
- American bullfrog — `Lithobates catesbeianus` — Amphibia;
- Blue crab — `Callinectes sapidus` — Malacostraca;
- Common octopus — `Octopus vulgaris` — Cephalopoda;
- Common earthworm — `Lumbricus terrestris` — Clitellata;
- Common starfish — `Asterias rubens` — Asteroidea;
- Moon jelly — `Aurelia aurita` — Scyphozoa.

The seed is expandable; ATLAS must report only the number of records actually loaded.

## Lovebug evidence baseline

For `Plecia nearctica`, the first release records:

- taxonomy: Animalia → Arthropoda → Insecta → Diptera → Bibionidae → Plecia → Plecia nearctica;
- adults are seasonal nuisance flies and are not represented as dangerous to human health;
- larvae feed on partially decayed vegetation and help recycle decaying plant material;
- the laboratory-created / mosquito-control origin story is explicitly treated as a myth, not a fact;
- source baseline includes University of Florida IFAS and GBIF / Catalogue of Life-backed taxonomy.

## Search and interaction

The Animal Kingdom route provides:

- text search across common name, scientific name, taxonomy and ecological roles;
- group filter;
- ecological-role filter;
- deterministic result count based only on loaded records;
- empty state when no records match;
- cards linking to species detail;
- detail page with taxonomy, ecology, human relationship, risks and sources;
- source links opening the actual evidence source;
- responsive layout for desktop, tablet and mobile.

No empty buttons, dead tabs or fake metrics are allowed.

## Supabase architecture

Supabase remains the production backend authority. The initial database contract uses three tables:

### `knowledge_animal_taxa`

Stores the accepted record and narrative fields. Records are globally readable to authenticated ATLAS users and managed through privileged service/admin workflows, not arbitrary browser writes.

### `knowledge_animal_roles`

Stores normalized ecological roles per taxon, allowing role filtering and analytics without parsing prose.

### `knowledge_animal_sources`

Stores provenance for each taxon and claim scope.

All tables require RLS. Browser clients get SELECT only. Inserts/updates/deletes remain denied to ordinary authenticated users unless a later governed editor workflow is approved.

The first UI release uses the repository-curated dataset as a deterministic fallback and must truthfully label the active source. Once the Supabase dataset is present, the authenticated adapter may return `supabase_live`; the UI must not claim live state when the network/database path is unavailable.

## Data adapter behavior

`getAnimalAtlasRecords()` attempts the authenticated Supabase read path when an ATLAS session is present. If authentication is absent or a live dataset is unavailable, it returns the repository-curated evidence dataset with source `repository_curated`.

This fallback is not demo data: records are evidence-backed curated knowledge. It is distinct from transactional production data and must not be labeled as a live Supabase dataset.

## Security and permissions

- Use the existing ATLAS Supabase publishable key boundary and session utilities.
- No service-role keys or secrets in browser code.
- RLS enabled on every new table.
- Anonymous database writes denied.
- Authenticated users receive read access only for this release.
- Mutations require a later privileged editor workflow and audit event.
- External source URLs are data, not executable instructions.

## UI ownership and navigation

Enterprise home adds Knowledge Atlas as an implemented module once the route exists. The sidebar adds `Knowledge`. Knowledge Atlas must coexist with Finance and Health rather than replacing them.

The visual language reuses current ATLAS cards, typography, spacing, status chips and responsive shell. A small module-specific stylesheet may be added instead of unrelated global redesign.

## Testing

Required tests:

1. Unit: search matches common/scientific names and ecological roles.
2. Unit: group and role filters compose correctly.
3. Unit: invalid/unknown filter produces an empty set rather than fabricated fallback.
4. Unit: lovebug seed retains the accepted scientific name, decomposer role and authoritative source metadata.
5. Integration: `/knowledge/animals` renders the module and records.
6. Integration: search/filter controls change visible results.
7. Integration: `/knowledge/animals/common-lovebug` renders taxonomy and source links.
8. Security contract: migration enables RLS and grants read-only browser semantics.
9. Build/typecheck must pass before merge when runner execution is available.

## Production truth gates

The module may be described as implemented in source only after code and tests exist. It may be described as merged only after the PR lands in `main`. It may be described as production only after Cloudflare serves the intended commit and `/knowledge/animals` is verified publicly. Supabase may be described as live only after the production `atlas-core` tables and rows are verified.

## Expansion path

This foundation is designed to grow continuously without changing the contract. Future increments can add:

- additional phyla, classes, orders, families, genera and species;
- geographic occurrence / range data;
- conservation integrations;
- image/media evidence;
- animal-human health links;
- Education lessons and assessments;
- ecosystem graphs and food-web relationships;
- multilingual names and descriptions;
- governed editor/reviewer workflows;
- provenance refresh jobs.

Expansion must remain evidence-first. A large catalog is not a justification for invented or unreviewed content.

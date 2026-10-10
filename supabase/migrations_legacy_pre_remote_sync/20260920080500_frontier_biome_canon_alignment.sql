-- Align durable FRONTIER biome records with the canonical Creative Bible.
-- Existing IDs are preserved so prior discoveries remain valid.

insert into public.frontier_codex_entries (id,category,title,required_stage,summary,detail)
values
  ('biome-luminous-grove','biome','Luminous Forest',1,
    'Biofiber-rich forest illuminated by symbiotic organisms.',
    'The Luminous Forest teaches renewable material harvesting, living-plot cultivation and ecological recovery without exhausting the biome.'),
  ('biome-aether-fields','biome','Crystalline Desert',3,
    'Mineral desert crossed by exposed Aetherium crystal fields.',
    'The Crystalline Desert combines scarce shelter, long sightlines and rich Aetherium seams that become dangerous conductors during ion activity.'),
  ('biome-tidal-reefs','biome','Biofiber Ocean',5,
    'Living ocean shaped by floating biofiber reefs and migratory ecosystems.',
    'Restoration depends on clean energy, seed-stock recovery, water-compatible infrastructure and preserving living substrates.'),
  ('biome-thermal-rifts','biome','Ionic Tundra',6,
    'Frozen terrain swept by electromagnetic fronts and unstable thermal gradients.',
    'Suit energy, shielding and thermal stabilization are essential while storms alter traversal and expose transient resources.'),
  ('biome-cloud-steppe','biome','Floating Mountains',8,
    'Suspended mountain systems above permanent cloud layers.',
    'Vertical traversal, atmospheric craft and orbital launch corridors define this high-altitude biome.'),
  ('biome-abandoned-city','biome','Abandoned Technological City',9,
    'A dormant megacity whose infrastructure failed during the Fracture.',
    'Recovered civic systems, Grid Wardens and sealed transit layers reveal how civilization depended on the Sky Grid and what restoration may reactivate.')
on conflict (id) do update set
  category=excluded.category,
  title=excluded.title,
  required_stage=excluded.required_stage,
  summary=excluded.summary,
  detail=excluded.detail;

comment on table public.frontier_codex_entries is
  'Canonical FRONTIER world Codex. Biome records align with the Creative Bible while preserving durable entry IDs.';

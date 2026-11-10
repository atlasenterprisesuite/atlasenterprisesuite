-- ATLAS FRONTIER world codex and governed discoveries.

create table if not exists public.frontier_codex_entries (
  id text primary key check (char_length(id) between 3 and 80),
  category text not null check (category in ('origin','planet','biome','faction','species','creature','anomaly','vehicle','technology')),
  title text not null,
  required_stage smallint not null check (required_stage between 1 and 10),
  summary text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

insert into public.frontier_codex_entries (id,category,title,required_stage,summary,detail)
values
  ('origin-fracture','origin','The Fracture',1,'The event that shattered the Sky Grid.','A synchronized lattice failure fragmented energy, transport and communications across the frontier.'),
  ('origin-restorers','origin','Frontier Restorers',1,'The explorers tasked with rebuilding connected worlds.','Restorers combine field engineering, ecology and civic reconstruction rather than serving as a military order.'),
  ('origin-aetherium','origin','Aetherium',1,'A crystalline energy-bearing material.','Aetherium stores lattice-compatible energy and becomes the basis for cores, relays and world-seed synthesis.'),
  ('origin-sky-grid','origin','Sky Grid',4,'The distributed energy and communications lattice.','Every restored sector improves local power resilience and eventually reconnects planetary and orbital infrastructure.'),
  ('planet-eos','planet','Eos Prime',1,'The first playable frontier world.','A temperate fractured world containing the crash zone, living valleys and the first recoverable Sky Grid sector.'),
  ('planet-nereid','planet','Nereid',5,'An oceanic world of floating reefs.','Nereid supports kelp-forest restoration, tidal energy and amphibious exploration.'),
  ('planet-cinder','planet','Cinder Reach',6,'A volcanic moon under violent thermal fronts.','Cinder Reach rewards heat management, geothermal engineering and hardened vehicles.'),
  ('planet-aurelia','planet','Aurelia',7,'A broad habitable world suited for cities.','Aurelia becomes a proving ground for settlement networks and civic-scale infrastructure.'),
  ('planet-veil','planet','Veil',8,'A low-gravity world surrounded by orbital debris.','Veil enables orbital construction, salvage and the first permanent station chain.'),
  ('planet-atlas-infinite','planet','Atlas Infinite Worlds',10,'Procedurally seeded frontier worlds.','World Seeds generate repeatable restoration cycles with governed parameters and persistent completion history.'),
  ('biome-luminous-grove','biome','Luminous Grove',1,'Biofiber-rich forests illuminated by symbiotic organisms.','The grove teaches renewable material harvesting and later supports cultivated living plots.'),
  ('biome-aether-fields','biome','Aether Fields',1,'Mineral plains crossed by exposed Aetherium seams.','The first reliable source of Aetherium and a high-risk location during ion storms.'),
  ('biome-tidal-reefs','biome','Tidal Reefs',5,'Shallow oceans with mobile reef ecologies.','Restoration depends on clean energy, seed-stock recovery and water-compatible infrastructure.'),
  ('biome-thermal-rifts','biome','Thermal Rifts',6,'Geothermal zones under extreme temperature changes.','Thermal stabilization systems are essential for prolonged field activity.'),
  ('biome-cloud-steppe','biome','Cloud Steppe',8,'High-altitude plateaus above permanent cloud layers.','The biome provides natural launch corridors for atmospheric and orbital vehicles.'),
  ('faction-keepers','faction','Grid Keepers',4,'Engineers preserving fragments of the old lattice.','The Keepers favor cautious restoration and demand evidence before reconnecting unstable sectors.'),
  ('faction-verdant','faction','Verdant Compact',5,'Ecologists focused on living-world recovery.','The Compact treats biodiversity and resource renewal as infrastructure rather than decoration.'),
  ('faction-forge','faction','Free Forge',6,'Independent fabricators and vehicle builders.','The Forge exchanges advanced fabrication knowledge for recovered materials and field data.'),
  ('faction-concord','faction','Frontier Concord',7,'A civic coalition connecting restored settlements.','The Concord coordinates standards, roads, emergency response and inter-settlement trade.'),
  ('faction-orbital','faction','Orbital Survey',8,'Explorers rebuilding the orbital layer.','Survey crews map debris, launch windows and stable transfer routes between worlds.'),
  ('species-human-restorer','species','Restorers',1,'Human and post-human frontier explorers.','Restorers use modular suits designed for environmental adaptation, fabrication and non-destructive resource recovery.'),
  ('species-lumen','species','Lumen',5,'Bioluminescent cooperative organisms.','Lumen colonies communicate through light patterns and help indicate healthy ecosystem recovery.'),
  ('species-tethri','species','Tethri',5,'Amphibious reef-builders from Nereid.','Tethri settlements grow with their environment and specialize in waterborne construction.'),
  ('species-aer','species','Aer',8,'Low-gravity adapted orbital inhabitants.','Aer communities maintain habitats where atmospheric and orbital infrastructure meet.'),
  ('creature-glider','creature','Lattice Glider',2,'A peaceful aerial grazer attracted to restored energy.','Gliders return as local ecosystem stability improves and serve as a visible restoration indicator.'),
  ('creature-burrower','creature','Alloy Burrower',3,'A subterranean scavenger nesting near wreckage.','Burrowers reorganize metallic debris and can expose hidden salvage veins.'),
  ('creature-tideback','creature','Tideback',5,'A large migratory reef creature.','Its migration depends on restored tidal corridors and clean water.'),
  ('creature-stormwing','creature','Stormwing',6,'An aerial creature adapted to ion storms.','Stormwings ride electromagnetic fronts and can signal changes in storm intensity.'),
  ('creature-warden','creature','Grid Warden',9,'An autonomous remnant protecting old network nodes.','Wardens can become allies or obstacles depending on whether the player presents valid restoration credentials.'),
  ('anomaly-echo','anomaly','Echo Field',3,'A spatial field replaying fragments of old telemetry.','Echo Fields reveal history but increase suit exposure if entered without protection.'),
  ('anomaly-ion','anomaly','Ion Cascade',6,'A rapidly moving electromagnetic hazard.','Shield integrity reduces damage while captured charge can be converted into useful energy.'),
  ('anomaly-fold','anomaly','Fold Scar',8,'A localized distortion left by the Fracture.','Orbital instruments are required to map Fold Scars safely.'),
  ('vehicle-rover','vehicle','Frontier Rover',6,'Ground exploration and cargo vehicle.','A modular rover carries materials between resource sites and settlements.'),
  ('vehicle-skimmer','vehicle','Tidal Skimmer',6,'Amphibious surface vehicle.','Designed for reefs, shallow seas and flooded biomes without damaging living substrates.'),
  ('vehicle-lifter','vehicle','Atmospheric Lifter',7,'Heavy aerial construction vehicle.','Moves habitat modules and settlement infrastructure across difficult terrain.'),
  ('vehicle-shuttle','vehicle','Orbital Shuttle',8,'Reusable surface-to-orbit transport.','Requires a stable Power Core and orbital navigation solution.'),
  ('vehicle-wayfarer','vehicle','Wayfarer',9,'Interworld network vessel.','Carries people and high-value cargo along verified Frontier Network routes.'),
  ('tech-fabricator','technology','Field Fabricator',1,'Transforms gathered materials into usable components.','The foundational crafting technology used by every Restorer.'),
  ('tech-habitat','technology','Habitat Architecture',2,'Modular sealed construction system.','Habitat modules form the basis for recovery, storage and later settlement growth.'),
  ('tech-power-core','technology','Power Core',3,'Stable high-density energy source.','Combines Aetherium, Alloy and Biofiber control structures.'),
  ('tech-grid-relay','technology','Grid Relay',4,'Reconnects isolated Sky Grid sectors.','Relays synchronize local power, communications and navigation.'),
  ('tech-bio-reactor','technology','Bio-Energy Reactor',5,'Generates clean energy from living systems.','Cultivated plots support renewable energy without exhausting local ecosystems.'),
  ('tech-storm-shield','technology','Storm Shield',6,'Protective electromagnetic field technology.','Shield integrity absorbs ion and anomaly exposure during dynamic hazards.'),
  ('tech-civic-grid','technology','Civic Grid',7,'Coordinates services across settlements.','Roads, emergency services, logistics and governance share a common civic data layer.'),
  ('tech-orbital-frame','technology','Orbital Frame',8,'Modular structure for permanent orbital stations.','Frames are assembled planetside, launched and joined in orbit.'),
  ('tech-network-gate','technology','Frontier Link',9,'Interworld communications and navigation relay.','Multiple verified links form the Frontier Network used by trade routes.'),
  ('tech-world-seed','technology','World Seed',10,'A governed template for generating new frontier worlds.','World Seeds encode terrain, ecology and restoration constraints for Atlas Infinite cycles.')
on conflict (id) do update set
  category=excluded.category,
  title=excluded.title,
  required_stage=excluded.required_stage,
  summary=excluded.summary,
  detail=excluded.detail;

create table if not exists public.frontier_codex_discoveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.frontier_runs(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_id text not null references public.frontier_codex_entries(id) on delete cascade,
  discovered_at timestamptz not null default now(),
  run_revision integer not null check (run_revision >= 0),
  constraint frontier_codex_discoveries_scope_check check (tenant_id = org_id),
  constraint frontier_codex_discoveries_unique unique (org_id, actor_user_id, entry_id)
);

create index if not exists frontier_codex_discoveries_tenant_idx on public.frontier_codex_discoveries(tenant_id);
create index if not exists frontier_codex_discoveries_run_idx on public.frontier_codex_discoveries(run_id);
create index if not exists frontier_codex_discoveries_actor_idx on public.frontier_codex_discoveries(actor_user_id);
create index if not exists frontier_codex_entries_stage_idx on public.frontier_codex_entries(required_stage,category);

alter table public.frontier_codex_entries enable row level security;
alter table public.frontier_codex_discoveries enable row level security;

revoke all on public.frontier_codex_entries from anon, authenticated;
revoke all on public.frontier_codex_discoveries from anon, authenticated;
grant select on public.frontier_codex_entries to authenticated;
grant select on public.frontier_codex_discoveries to authenticated;
grant all on public.frontier_codex_entries to service_role;
grant all on public.frontier_codex_discoveries to service_role;

drop policy if exists frontier_codex_entries_read on public.frontier_codex_entries;
create policy frontier_codex_entries_read
  on public.frontier_codex_entries for select to authenticated
  using (required_stage <= 10);

drop policy if exists frontier_codex_discoveries_read_own on public.frontier_codex_discoveries;
create policy frontier_codex_discoveries_read_own
  on public.frontier_codex_discoveries for select to authenticated
  using (
    actor_user_id=(select auth.uid())
    and (
      public.has_identity_permission(org_id,'frontier.read')
      or public.has_identity_permission(org_id,'frontier.play')
      or public.has_identity_permission(org_id,'frontier.manage')
    )
  );

create or replace function public.frontier_discover_codex_entry(
  p_org_id uuid,
  p_entry_id text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_run public.frontier_runs%rowtype;
  v_entry public.frontier_codex_entries%rowtype;
  v_discovery public.frontier_codex_discoveries%rowtype;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='28000'; end if;
  if p_org_id is null or not (
    public.has_identity_permission(p_org_id,'frontier.play')
    or public.has_identity_permission(p_org_id,'frontier.manage')
  ) then raise exception 'frontier_permission_denied' using errcode='42501'; end if;

  select * into v_run from public.frontier_runs
  where org_id=p_org_id and actor_user_id=v_user_id
  for update;
  if not found then raise exception 'frontier_run_unavailable'; end if;

  select * into v_entry from public.frontier_codex_entries where id=btrim(p_entry_id);
  if not found then raise exception 'frontier_codex_entry_unknown' using errcode='22023'; end if;
  if v_entry.required_stage > v_run.campaign_stage then
    raise exception 'frontier_codex_entry_locked' using errcode='P0001';
  end if;

  insert into public.frontier_codex_discoveries(
    tenant_id,org_id,run_id,actor_user_id,entry_id,run_revision
  ) values (
    p_org_id,p_org_id,v_run.id,v_user_id,v_entry.id,v_run.revision
  )
  on conflict(org_id,actor_user_id,entry_id) do nothing;

  select * into v_discovery from public.frontier_codex_discoveries
  where org_id=p_org_id and actor_user_id=v_user_id and entry_id=v_entry.id;

  return jsonb_build_object(
    'ok',true,
    'entry_id',v_entry.id,
    'required_stage',v_entry.required_stage,
    'discovered_at',v_discovery.discovered_at,
    'run_revision',v_discovery.run_revision
  );
end;
$$;

revoke all on function public.frontier_discover_codex_entry(uuid,text) from public,anon;
grant execute on function public.frontier_discover_codex_entry(uuid,text) to authenticated;

comment on function public.frontier_discover_codex_entry(uuid,text) is
  'Governed FRONTIER Codex discovery RPC. Validates identity, organization permission and campaign stage before recording a durable discovery.';

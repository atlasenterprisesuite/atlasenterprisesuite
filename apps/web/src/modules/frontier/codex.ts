export type FrontierCodexCategory =
  | 'origin'
  | 'planet'
  | 'biome'
  | 'faction'
  | 'species'
  | 'creature'
  | 'anomaly'
  | 'vehicle'
  | 'technology';

export type FrontierCodexEntry = {
  id: string;
  category: FrontierCodexCategory;
  title: string;
  requiredStage: number;
  summary: string;
  detail: string;
};

export const FRONTIER_ORIGIN = {
  title: 'The Fracture and the Sky Grid',
  summary: 'ATLAS FRONTIER begins after the planetary Sky Grid fractured, isolating settlements, destabilizing ecosystems and severing orbital links.',
  detail: 'Aetherium once powered a distributed planetary lattice called the Sky Grid. A cascade known as the Fracture split the lattice into isolated sectors. The player wakes as a Frontier Restorer whose mission is not conquest but reconstruction: recover matter, reconnect power, restore ecosystems, rebuild civilization and eventually seed new worlds.'
} as const;

export const FRONTIER_CODEX: readonly FrontierCodexEntry[] = [
  { id:'origin-fracture',category:'origin',title:'The Fracture',requiredStage:1,summary:'The event that shattered the Sky Grid.',detail:'A synchronized lattice failure fragmented energy, transport and communications across the frontier.' },
  { id:'origin-restorers',category:'origin',title:'Frontier Restorers',requiredStage:1,summary:'The explorers tasked with rebuilding connected worlds.',detail:'Restorers combine field engineering, ecology and civic reconstruction rather than serving as a military order.' },
  { id:'origin-aetherium',category:'origin',title:'Aetherium',requiredStage:1,summary:'A crystalline energy-bearing material.',detail:'Aetherium stores lattice-compatible energy and becomes the basis for cores, relays and world-seed synthesis.' },
  { id:'origin-sky-grid',category:'origin',title:'Sky Grid',requiredStage:4,summary:'The distributed energy and communications lattice.',detail:'Every restored sector improves local power resilience and eventually reconnects planetary and orbital infrastructure.' },

  { id:'planet-eos',category:'planet',title:'Eos Prime',requiredStage:1,summary:'The first playable frontier world.',detail:'A temperate fractured world containing the crash zone, living valleys and the first recoverable Sky Grid sector.' },
  { id:'planet-nereid',category:'planet',title:'Nereid',requiredStage:5,summary:'An oceanic world of floating reefs.',detail:'Nereid supports kelp-forest restoration, tidal energy and amphibious exploration.' },
  { id:'planet-cinder',category:'planet',title:'Cinder Reach',requiredStage:6,summary:'A volcanic moon under violent thermal fronts.',detail:'Cinder Reach rewards heat management, geothermal engineering and hardened vehicles.' },
  { id:'planet-aurelia',category:'planet',title:'Aurelia',requiredStage:7,summary:'A broad habitable world suited for cities.',detail:'Aurelia becomes a proving ground for settlement networks and civic-scale infrastructure.' },
  { id:'planet-veil',category:'planet',title:'Veil',requiredStage:8,summary:'A low-gravity world surrounded by orbital debris.',detail:'Veil enables orbital construction, salvage and the first permanent station chain.' },
  { id:'planet-atlas-infinite',category:'planet',title:'Atlas Infinite Worlds',requiredStage:10,summary:'Procedurally seeded frontier worlds.',detail:'World Seeds generate repeatable restoration cycles with governed parameters and persistent completion history.' },

  { id:'biome-luminous-grove',category:'biome',title:'Luminous Grove',requiredStage:1,summary:'Biofiber-rich forests illuminated by symbiotic organisms.',detail:'The grove teaches renewable material harvesting and later supports cultivated living plots.' },
  { id:'biome-aether-fields',category:'biome',title:'Aether Fields',requiredStage:1,summary:'Mineral plains crossed by exposed Aetherium seams.',detail:'The first reliable source of Aetherium and a high-risk location during ion storms.' },
  { id:'biome-tidal-reefs',category:'biome',title:'Tidal Reefs',requiredStage:5,summary:'Shallow oceans with mobile reef ecologies.',detail:'Restoration depends on clean energy, seed-stock recovery and water-compatible infrastructure.' },
  { id:'biome-thermal-rifts',category:'biome',title:'Thermal Rifts',requiredStage:6,summary:'Geothermal zones under extreme temperature changes.',detail:'Thermal stabilization systems are essential for prolonged field activity.' },
  { id:'biome-cloud-steppe',category:'biome',title:'Cloud Steppe',requiredStage:8,summary:'High-altitude plateaus above permanent cloud layers.',detail:'The biome provides natural launch corridors for atmospheric and orbital vehicles.' },

  { id:'faction-keepers',category:'faction',title:'Grid Keepers',requiredStage:4,summary:'Engineers preserving fragments of the old lattice.',detail:'The Keepers favor cautious restoration and demand evidence before reconnecting unstable sectors.' },
  { id:'faction-verdant',category:'faction',title:'Verdant Compact',requiredStage:5,summary:'Ecologists focused on living-world recovery.',detail:'The Compact treats biodiversity and resource renewal as infrastructure rather than decoration.' },
  { id:'faction-forge',category:'faction',title:'Free Forge',requiredStage:6,summary:'Independent fabricators and vehicle builders.',detail:'The Forge exchanges advanced fabrication knowledge for recovered materials and field data.' },
  { id:'faction-concord',category:'faction',title:'Frontier Concord',requiredStage:7,summary:'A civic coalition connecting restored settlements.',detail:'The Concord coordinates standards, roads, emergency response and inter-settlement trade.' },
  { id:'faction-orbital',category:'faction',title:'Orbital Survey',requiredStage:8,summary:'Explorers rebuilding the orbital layer.',detail:'Survey crews map debris, launch windows and stable transfer routes between worlds.' },

  { id:'species-human-restorer',category:'species',title:'Restorers',requiredStage:1,summary:'Human and post-human frontier explorers.',detail:'Restorers use modular suits designed for environmental adaptation, fabrication and non-destructive resource recovery.' },
  { id:'species-lumen',category:'species',title:'Lumen',requiredStage:5,summary:'Bioluminescent cooperative organisms.',detail:'Lumen colonies communicate through light patterns and help indicate healthy ecosystem recovery.' },
  { id:'species-tethri',category:'species',title:'Tethri',requiredStage:5,summary:'Amphibious reef-builders from Nereid.',detail:'Tethri settlements grow with their environment and specialize in waterborne construction.' },
  { id:'species-aer',category:'species',title:'Aer',requiredStage:8,summary:'Low-gravity adapted orbital inhabitants.',detail:'Aer communities maintain habitats where atmospheric and orbital infrastructure meet.' },

  { id:'creature-glider',category:'creature',title:'Lattice Glider',requiredStage:2,summary:'A peaceful aerial grazer attracted to restored energy.',detail:'Gliders return as local ecosystem stability improves and serve as a visible restoration indicator.' },
  { id:'creature-burrower',category:'creature',title:'Alloy Burrower',requiredStage:3,summary:'A subterranean scavenger nesting near wreckage.',detail:'Burrowers reorganize metallic debris and can expose hidden salvage veins.' },
  { id:'creature-tideback',category:'creature',title:'Tideback',requiredStage:5,summary:'A large migratory reef creature.',detail:'Its migration depends on restored tidal corridors and clean water.' },
  { id:'creature-stormwing',category:'creature',title:'Stormwing',requiredStage:6,summary:'An aerial creature adapted to ion storms.',detail:'Stormwings ride electromagnetic fronts and can signal changes in storm intensity.' },
  { id:'creature-warden',category:'creature',title:'Grid Warden',requiredStage:9,summary:'An autonomous remnant protecting old network nodes.',detail:'Wardens can become allies or obstacles depending on whether the player presents valid restoration credentials.' },

  { id:'anomaly-echo',category:'anomaly',title:'Echo Field',requiredStage:3,summary:'A spatial field replaying fragments of old telemetry.',detail:'Echo Fields reveal history but increase suit exposure if entered without protection.' },
  { id:'anomaly-ion',category:'anomaly',title:'Ion Cascade',requiredStage:6,summary:'A rapidly moving electromagnetic hazard.',detail:'Shield integrity reduces damage while captured charge can be converted into useful energy.' },
  { id:'anomaly-fold',category:'anomaly',title:'Fold Scar',requiredStage:8,summary:'A localized distortion left by the Fracture.',detail:'Orbital instruments are required to map Fold Scars safely.' },

  { id:'vehicle-rover',category:'vehicle',title:'Frontier Rover',requiredStage:6,summary:'Ground exploration and cargo vehicle.',detail:'A modular rover carries materials between resource sites and settlements.' },
  { id:'vehicle-skimmer',category:'vehicle',title:'Tidal Skimmer',requiredStage:6,summary:'Amphibious surface vehicle.',detail:'Designed for reefs, shallow seas and flooded biomes without damaging living substrates.' },
  { id:'vehicle-lifter',category:'vehicle',title:'Atmospheric Lifter',requiredStage:7,summary:'Heavy aerial construction vehicle.',detail:'Moves habitat modules and settlement infrastructure across difficult terrain.' },
  { id:'vehicle-shuttle',category:'vehicle',title:'Orbital Shuttle',requiredStage:8,summary:'Reusable surface-to-orbit transport.',detail:'Requires a stable Power Core and orbital navigation solution.' },
  { id:'vehicle-wayfarer',category:'vehicle',title:'Wayfarer',requiredStage:9,summary:'Interworld network vessel.',detail:'Carries people and high-value cargo along verified Frontier Network routes.' },

  { id:'tech-fabricator',category:'technology',title:'Field Fabricator',requiredStage:1,summary:'Transforms gathered materials into usable components.',detail:'The foundational crafting technology used by every Restorer.' },
  { id:'tech-habitat',category:'technology',title:'Habitat Architecture',requiredStage:2,summary:'Modular sealed construction system.',detail:'Habitat modules form the basis for recovery, storage and later settlement growth.' },
  { id:'tech-power-core',category:'technology',title:'Power Core',requiredStage:3,summary:'Stable high-density energy source.',detail:'Combines Aetherium, Alloy and Biofiber control structures.' },
  { id:'tech-grid-relay',category:'technology',title:'Grid Relay',requiredStage:4,summary:'Reconnects isolated Sky Grid sectors.',detail:'Relays synchronize local power, communications and navigation.' },
  { id:'tech-bio-reactor',category:'technology',title:'Bio-Energy Reactor',requiredStage:5,summary:'Generates clean energy from living systems.',detail:'Cultivated plots support renewable energy without exhausting local ecosystems.' },
  { id:'tech-storm-shield',category:'technology',title:'Storm Shield',requiredStage:6,summary:'Protective electromagnetic field technology.',detail:'Shield integrity absorbs ion and anomaly exposure during dynamic hazards.' },
  { id:'tech-civic-grid',category:'technology',title:'Civic Grid',requiredStage:7,summary:'Coordinates services across settlements.',detail:'Roads, emergency services, logistics and governance share a common civic data layer.' },
  { id:'tech-orbital-frame',category:'technology',title:'Orbital Frame',requiredStage:8,summary:'Modular structure for permanent orbital stations.',detail:'Frames are assembled planetside, launched and joined in orbit.' },
  { id:'tech-network-gate',category:'technology',title:'Frontier Link',requiredStage:9,summary:'Interworld communications and navigation relay.',detail:'Multiple verified links form the Frontier Network used by trade routes.' },
  { id:'tech-world-seed',category:'technology',title:'World Seed',requiredStage:10,summary:'A governed template for generating new frontier worlds.',detail:'World Seeds encode terrain, ecology and restoration constraints for Atlas Infinite cycles.' }
] as const;

export const FRONTIER_CODEX_CATEGORIES: readonly FrontierCodexCategory[] = [
  'origin','planet','biome','faction','species','creature','anomaly','vehicle','technology'
] as const;

export function codexEntriesForStage(stage: number) {
  return FRONTIER_CODEX.filter((entry) => entry.requiredStage <= stage);
}

export function codexCompletion(stage: number, discoveredIds: ReadonlySet<string>) {
  const available = codexEntriesForStage(stage);
  if (available.length === 0) return 0;
  const discovered = available.filter((entry) => discoveredIds.has(entry.id)).length;
  return Math.round((discovered / available.length) * 100);
}

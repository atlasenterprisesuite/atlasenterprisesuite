begin;

insert into public.knowledge_animal_taxa (
  slug, scientific_name, common_names, rank, animal_group, taxonomy,
  habitat, diet, reproduction, human_relationship, risks,
  conservation_status, medical_relevance, evidence_state,
  myth_correction, purpose_interpretation, reviewed_at, is_published
)
values
(
  'common-lovebug', 'Plecia nearctica', array['Common lovebug','Lovebug'], 'species', 'Insects',
  '{"kingdom":"Animalia","phylum":"Arthropoda","class":"Insecta","order":"Diptera","family":"Bibionidae","genus":"Plecia","species":"Plecia nearctica"}'::jsonb,
  'Warm terrestrial environments in the southeastern United States; larvae develop in moist organic material and partially decayed vegetation.',
  'Larvae feed on partially decayed vegetation and organic matter. Adults obtain plant-derived resources and are commonly seen around flowering vegetation.',
  'Adults mate in paired flight or while resting; eggs hatch into larvae that develop in organic material before pupating.',
  'A seasonal nuisance around roads, buildings and vehicles, while the larval stage contributes to decomposition and nutrient recycling.',
  array['Large seasonal flights can foul vehicle surfaces and reduce visibility when insects accumulate on windshields.'],
  null,
  'University of Florida guidance describes lovebugs as a nuisance rather than a biting or disease-transmitting human pest.',
  'verified_source',
  'The claim that lovebugs were created or engineered by the University of Florida to control mosquitoes is a myth. UF/IFAS documents that the species was already established before university and USDA research began.',
  null, '2026-09-08', true
),
(
  'african-bush-elephant', 'Loxodonta africana', array['African bush elephant','African savanna elephant'], 'species', 'Mammals',
  '{"kingdom":"Animalia","phylum":"Chordata","class":"Mammalia","order":"Proboscidea","family":"Elephantidae","genus":"Loxodonta","species":"Loxodonta africana"}'::jsonb,
  'Savannas, woodlands, scrub, forests and other African habitats where water and vegetation are available.',
  'Herbivorous browser and grazer that consumes grasses, leaves, fruit, roots, twigs and bark.',
  'Sexual, live-bearing reproduction; females typically produce a single calf after a gestation of roughly 22 months and receive social support from herd members.',
  'A major conservation species whose movements, foraging and habitat use strongly influence landscapes and human-wildlife management.',
  array['Wild elephants are extremely large animals and can be dangerous when threatened or when people enter conflict zones.'],
  'Endangered', null, 'curated_reference', null, null, '2026-09-08', true
),
(
  'ruby-throated-hummingbird', 'Archilochus colubris', array['Ruby-throated hummingbird'], 'species', 'Birds',
  '{"kingdom":"Animalia","phylum":"Chordata","class":"Aves","order":"Apodiformes","family":"Trochilidae","genus":"Archilochus","species":"Archilochus colubris"}'::jsonb,
  'Open deciduous woodlands, forest edges, meadows, orchards, stream borders and backyards in the breeding range, with tropical forest and scrub habitats on wintering grounds.',
  'Primarily flower nectar, supplemented with small insects, spiders and occasionally tree sap.',
  'Females build small nests bound with spider silk, incubate the eggs and provide parental care; males do not participate in raising the young.',
  'A migratory pollinator commonly supported by native flowering plants and responsibly maintained nectar feeders.',
  '{}'::text[], 'Low Concern', null, 'verified_source', null, null, '2026-09-08', true
),
(
  'american-alligator', 'Alligator mississippiensis', array['American alligator','Alligator','Gator'], 'species', 'Reptiles',
  '{"kingdom":"Animalia","phylum":"Chordata","class":"Reptilia","order":"Crocodilia","family":"Alligatoridae","genus":"Alligator","species":"Alligator mississippiensis"}'::jsonb,
  'Semi-aquatic freshwater and brackish habitats including marshes, swamps, lakes, ponds and slow-moving waterways in the southeastern United States.',
  'Opportunistic carnivore that preys on aquatic and terrestrial animals available within its habitat.',
  'Females lay eggs in vegetation-based nests and guard nests and young during early development.',
  'A native apex or near-apex wetland predator with major conservation and human-wildlife management significance.',
  array['Wild alligators can seriously injure people; feeding or approaching them increases risk and can alter normal behavior.'],
  null, null, 'verified_source', null, null, '2026-09-08', true
),
(
  'american-bullfrog', 'Lithobates catesbeianus', array['American bullfrog','Bullfrog'], 'species', 'Amphibians',
  '{"kingdom":"Animalia","phylum":"Chordata","class":"Amphibia","order":"Anura","family":"Ranidae","genus":"Lithobates","species":"Lithobates catesbeianus"}'::jsonb,
  'Permanent or semi-permanent freshwater habitats such as ponds, lakes, reservoirs, marshes and slow-moving streams.',
  'Generalist predator that consumes a wide range of invertebrates and small vertebrates it can capture.',
  'Aquatic breeding produces eggs that develop into tadpoles before metamorphosing into terrestrial-aquatic adults.',
  'Native in eastern North America but widely introduced elsewhere, where it can affect native species and food webs.',
  array['Introduced populations can become invasive and contribute to ecological impacts outside the native range.'],
  null, null, 'verified_source', null, null, '2026-09-08', true
),
(
  'blue-crab', 'Callinectes sapidus', array['Blue crab','Atlantic blue crab'], 'species', 'Crustaceans',
  '{"kingdom":"Animalia","phylum":"Arthropoda","class":"Malacostraca","order":"Decapoda","family":"Portunidae","genus":"Callinectes","species":"Callinectes sapidus"}'::jsonb,
  'Estuarine and coastal habitats ranging from shallow brackish water and submerged aquatic grass beds to oyster reefs and deeper, saltier water.',
  'Omnivorous benthic feeder and predator/scavenger consuming mollusks, small animals and organic material.',
  'Sexual reproduction with mating linked to the female molt cycle; females carry developing eggs externally beneath the abdomen.',
  'An ecologically important estuarine species and a major commercial and recreational fishery resource.',
  array['Handling live crabs can result in painful pinches from the claws.'],
  null, null, 'verified_source', null, null, '2026-09-08', true
),
(
  'common-octopus', 'Octopus vulgaris', array['Common octopus'], 'species', 'Mollusks',
  '{"kingdom":"Animalia","phylum":"Mollusca","class":"Cephalopoda","order":"Octopoda","family":"Octopodidae","genus":"Octopus","species":"Octopus vulgaris"}'::jsonb,
  'Marine benthic habitats where individuals occupy dens, crevices, rocky areas, reefs and other shelter from shallow coastal water across a broad depth range.',
  'Carnivorous predator that consumes crustaceans, mollusks and other suitable marine prey.',
  'Sexual reproduction; females attach large numbers of eggs to sheltered substrate, brood and clean them, and typically die after the eggs hatch.',
  'A highly intelligent marine invertebrate important to marine ecology, research and fisheries in parts of its range.',
  array['Wild octopuses should be observed without handling; defensive bites are possible.'],
  null, null, 'curated_reference', null, null, '2026-09-08', true
),
(
  'common-earthworm', 'Lumbricus terrestris', array['Common earthworm','Nightcrawler','Dew worm'], 'species', 'Annelids',
  '{"kingdom":"Animalia","phylum":"Annelida","class":"Clitellata","order":"Haplotaxida","family":"Lumbricidae","genus":"Lumbricus","species":"Lumbricus terrestris"}'::jsonb,
  'Terrestrial soils where permanent vertical burrows connect deeper mineral soil to surface litter.',
  'Detritivore that pulls partially decomposed surface litter and other organic matter into its burrow.',
  'Sexual reproduction between hermaphroditic individuals, followed by production of cocoons containing developing young.',
  'Can improve soil structure and nutrient cycling in ecosystems with earthworm history, but introduced populations can disrupt litter layers and nutrient dynamics in previously earthworm-free northern forests.',
  array['Ecological impacts are possible when introduced outside the native or historically earthworm-influenced range.'],
  null, null, 'verified_source', null, null, '2026-09-08', true
),
(
  'common-starfish', 'Asterias rubens', array['Common starfish','Common sea star'], 'species', 'Echinoderms',
  '{"kingdom":"Animalia","phylum":"Echinodermata","class":"Asteroidea","order":"Forcipulatida","family":"Asteriidae","genus":"Asterias","species":"Asterias rubens"}'::jsonb,
  'Marine intertidal and subtidal habitats on rock, sand, gravel, mud flats and mussel beds.',
  'Carnivorous benthic predator that commonly consumes bivalves such as mussels and clams as well as other invertebrates.',
  'Sexual spawning releases gametes into seawater; development includes a planktonic larval phase before settlement and metamorphosis.',
  'A familiar north-east Atlantic sea star that can influence shellfish beds through predation.',
  '{}'::text[], null, null, 'curated_reference', null, null, '2026-09-08', true
),
(
  'moon-jelly', 'Aurelia aurita', array['Moon jelly','Moon jellyfish'], 'species', 'Cnidarians',
  '{"kingdom":"Animalia","phylum":"Cnidaria","class":"Scyphozoa","order":"Semaeostomeae","family":"Ulmaridae","genus":"Aurelia","species":"Aurelia aurita"}'::jsonb,
  'Marine and brackish coastal waters spanning surface and deeper pelagic zones, with environmental tolerance varying by temperature and salinity.',
  'Carnivorous planktivore that captures plankton, copepods, mollusks, fish eggs and other small organisms with tentacles and oral arms.',
  'The life cycle alternates between sexually reproducing medusae and attached polyps that can reproduce asexually and release juvenile ephyrae.',
  'A common jellyfish used in education and aquarium displays and an important participant in coastal food webs.',
  array['Possesses stinging cells; contact can irritate sensitive skin even though effects are usually milder than many other jellyfish species.'],
  null, null, 'curated_reference', null, null, '2026-09-08', true
)
on conflict (slug) do update set
  scientific_name = excluded.scientific_name,
  common_names = excluded.common_names,
  rank = excluded.rank,
  animal_group = excluded.animal_group,
  taxonomy = excluded.taxonomy,
  habitat = excluded.habitat,
  diet = excluded.diet,
  reproduction = excluded.reproduction,
  human_relationship = excluded.human_relationship,
  risks = excluded.risks,
  conservation_status = excluded.conservation_status,
  medical_relevance = excluded.medical_relevance,
  evidence_state = excluded.evidence_state,
  myth_correction = excluded.myth_correction,
  purpose_interpretation = excluded.purpose_interpretation,
  reviewed_at = excluded.reviewed_at,
  is_published = excluded.is_published,
  updated_at = now();

with role_seed(slug, role) as (
  values
    ('common-lovebug','nutrient recycling'), ('common-lovebug','detritivore'),
    ('african-bush-elephant','herbivore'), ('african-bush-elephant','vegetation shaping'), ('african-bush-elephant','seed dispersal'),
    ('ruby-throated-hummingbird','pollinator'), ('ruby-throated-hummingbird','insect predator'),
    ('american-alligator','predator'), ('american-alligator','ecosystem engineer'),
    ('american-bullfrog','predator'), ('american-bullfrog','prey species'),
    ('blue-crab','predator'), ('blue-crab','scavenger'), ('blue-crab','prey species'),
    ('common-octopus','predator'), ('common-octopus','prey species'),
    ('common-earthworm','detritivore'), ('common-earthworm','nutrient recycling'), ('common-earthworm','soil mixing'), ('common-earthworm','soil aeration'),
    ('common-starfish','benthic predator'), ('common-starfish','prey species'),
    ('moon-jelly','planktivore'), ('moon-jelly','predator'), ('moon-jelly','prey species')
)
insert into public.knowledge_animal_roles (taxon_id, role)
select taxon.id, role_seed.role
from role_seed
join public.knowledge_animal_taxa taxon on taxon.slug = role_seed.slug
on conflict (taxon_id, role) do nothing;

with source_seed(slug, title, organization, source_url, source_type, claim_scope, reviewed_at) as (
  values
    ('common-lovebug','Lovebugs, Plecia nearctica Hardy (Insecta: Diptera: Bibionidae)','University of Florida IFAS Extension','https://ask.ifas.ufl.edu/publication/IN204','institutional','taxonomy, life history, larval feeding, ecological benefit and origin myth correction','2026-09-08'::date),
    ('common-lovebug','Plecia nearctica Hardy, 1940','GBIF / Catalogue of Life','https://www.gbif.org/taxon/782VY','taxonomic','accepted scientific name and taxonomic placement','2026-09-08'::date),
    ('african-bush-elephant','Loxodonta africana (African bush elephant)','Animal Diversity Web, University of Michigan Museum of Zoology','https://animaldiversity.org/accounts/Loxodonta_africana/','reference','habitat, diet, reproduction and social life history','2026-09-08'::date),
    ('ruby-throated-hummingbird','Ruby-throated Hummingbird Life History','Cornell Lab of Ornithology — All About Birds','https://www.allaboutbirds.org/guide/Ruby-throated_Hummingbird/lifehistory','institutional','habitat, diet and nesting','2026-09-08'::date),
    ('american-alligator','American Alligator (Alligator mississippiensis)','U.S. Fish & Wildlife Service','https://www.fws.gov/species/american-alligator-alligator-mississippiensis','institutional','accepted name, classification, physical description and range context','2026-09-08'::date),
    ('american-bullfrog','American Bullfrog (Lithobates catesbeianus) — Nonindigenous Aquatic Species','U.S. Geological Survey','https://nas.er.usgs.gov/Queries/FactSheet.aspx?SpeciesID=71','institutional','taxonomy, habitat, feeding ecology, reproduction and introduced impacts','2026-09-08'::date),
    ('blue-crab','Blue Crab','NOAA Fisheries','https://www.fisheries.noaa.gov/species/blue-crab','institutional','taxonomy, habitat, life history and fishery context','2026-09-08'::date),
    ('common-octopus','Octopus vulgaris Cuvier, 1797','World Register of Marine Species (WoRMS)','https://www.marinespecies.org/aphia.php?id=140605&p=taxdetails','taxonomic','accepted scientific name and taxonomic status','2026-09-08'::date),
    ('common-earthworm','Earthworms','University of Illinois — Soil Quality for Environmental Health','https://soilquality.nres.illinois.edu/earthworms/','institutional','soil structure, decomposition, nutrient cycling and nonnative impacts','2026-09-08'::date),
    ('common-starfish','Common starfish (Asterias rubens)','Marine Life Information Network (MarLIN)','https://www.marlin.ac.uk/species/detail/1194','reference','distribution, habitat and ecology','2026-09-08'::date),
    ('moon-jelly','Aurelia aurita (Moon jellyfish)','Animal Diversity Web, University of Michigan Museum of Zoology','https://animaldiversity.org/accounts/Aurelia_aurita/','reference','habitat, development, reproduction, diet and predators','2026-09-08'::date)
)
insert into public.knowledge_animal_sources (
  taxon_id, title, organization, source_url, source_type, claim_scope, reviewed_at
)
select taxon.id, source_seed.title, source_seed.organization, source_seed.source_url, source_seed.source_type, source_seed.claim_scope, source_seed.reviewed_at
from source_seed
join public.knowledge_animal_taxa taxon on taxon.slug = source_seed.slug
on conflict (taxon_id, source_url) do update set
  title = excluded.title,
  organization = excluded.organization,
  source_type = excluded.source_type,
  claim_scope = excluded.claim_scope,
  reviewed_at = excluded.reviewed_at;

commit;

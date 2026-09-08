import type { AnimalTaxon } from '../../packages/knowledge/animal-atlas';

const reviewedAt = '2026-09-08';

export const animalAtlasSeed: AnimalTaxon[] = [
  {
    id: 'plecia-nearctica',
    slug: 'common-lovebug',
    scientificName: 'Plecia nearctica',
    commonNames: ['Common lovebug', 'Lovebug'],
    rank: 'species',
    group: 'Insects',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Arthropoda',
      class: 'Insecta',
      order: 'Diptera',
      family: 'Bibionidae',
      genus: 'Plecia',
      species: 'Plecia nearctica'
    },
    habitat: 'Warm terrestrial environments in the southeastern United States; larvae develop in moist organic material and partially decayed vegetation.',
    diet: 'Larvae feed on partially decayed vegetation and organic matter. Adults obtain plant-derived resources and are commonly seen around flowering vegetation.',
    reproduction: 'Adults mate in paired flight or while resting; eggs hatch into larvae that develop in organic material before pupating.',
    ecologicalRoles: ['nutrient recycling', 'detritivore'],
    humanRelationship: 'A seasonal nuisance around roads, buildings and vehicles, while the larval stage contributes to decomposition and nutrient recycling.',
    risks: ['Large seasonal flights can foul vehicle surfaces and reduce visibility when insects accumulate on windshields.'],
    conservationStatus: null,
    medicalRelevance: 'University of Florida guidance describes lovebugs as a nuisance rather than a biting or disease-transmitting human pest.',
    evidenceState: 'verified_source',
    reviewedAt,
    mythCorrection: 'The claim that lovebugs were created or engineered by the University of Florida to control mosquitoes is a myth. UF/IFAS documents that the species was already established before university and USDA research began.',
    purposeInterpretation: null,
    sources: [
      {
        title: 'Lovebugs, Plecia nearctica Hardy (Insecta: Diptera: Bibionidae)',
        organization: 'University of Florida IFAS Extension',
        url: 'https://ask.ifas.ufl.edu/publication/IN204',
        sourceType: 'institutional',
        claimScope: 'taxonomy, life history, larval feeding, ecological benefit and origin myth correction',
        reviewedAt
      },
      {
        title: 'Living with Lovebugs',
        organization: 'University of Florida IFAS Extension',
        url: 'https://edis.ifas.ufl.edu/publication/IN694',
        sourceType: 'institutional',
        claimScope: 'human nuisance context and myth correction',
        reviewedAt
      },
      {
        title: 'Plecia nearctica Hardy, 1940',
        organization: 'GBIF / Catalogue of Life',
        url: 'https://www.gbif.org/taxon/782VY',
        sourceType: 'taxonomic',
        claimScope: 'accepted scientific name and taxonomic placement',
        reviewedAt
      }
    ]
  },
  {
    id: 'loxodonta-africana',
    slug: 'african-bush-elephant',
    scientificName: 'Loxodonta africana',
    commonNames: ['African bush elephant', 'African savanna elephant'],
    rank: 'species',
    group: 'Mammals',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Mammalia',
      order: 'Proboscidea',
      family: 'Elephantidae',
      genus: 'Loxodonta',
      species: 'Loxodonta africana'
    },
    habitat: 'Savannas, woodlands, scrub, forests and other African habitats where water and vegetation are available.',
    diet: 'Herbivorous browser and grazer that consumes grasses, leaves, fruit, roots, twigs and bark.',
    reproduction: 'Sexual, live-bearing reproduction; females typically produce a single calf after a gestation of roughly 22 months and receive social support from herd members.',
    ecologicalRoles: ['herbivore', 'vegetation shaping', 'seed dispersal'],
    humanRelationship: 'A major conservation species whose movements, foraging and habitat use strongly influence landscapes and human-wildlife management.',
    risks: ['Wild elephants are extremely large animals and can be dangerous when threatened or when people enter conflict zones.'],
    conservationStatus: 'Endangered',
    medicalRelevance: null,
    evidenceState: 'curated_reference',
    reviewedAt,
    sources: [
      {
        title: 'Loxodonta africana (African bush elephant)',
        organization: 'Animal Diversity Web, University of Michigan Museum of Zoology',
        url: 'https://animaldiversity.org/accounts/Loxodonta_africana/',
        sourceType: 'reference',
        claimScope: 'habitat, diet, reproduction and social life history',
        reviewedAt
      },
      {
        title: 'Loxodonta africana',
        organization: 'GBIF',
        url: 'https://www.gbif.org/species/102119545',
        sourceType: 'taxonomic',
        claimScope: 'taxonomy and conservation metadata',
        reviewedAt
      }
    ]
  },
  {
    id: 'archilochus-colubris',
    slug: 'ruby-throated-hummingbird',
    scientificName: 'Archilochus colubris',
    commonNames: ['Ruby-throated hummingbird'],
    rank: 'species',
    group: 'Birds',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Aves',
      order: 'Apodiformes',
      family: 'Trochilidae',
      genus: 'Archilochus',
      species: 'Archilochus colubris'
    },
    habitat: 'Open deciduous woodlands, forest edges, meadows, orchards, stream borders and backyards in the breeding range, with tropical forest and scrub habitats on wintering grounds.',
    diet: 'Primarily flower nectar, supplemented with small insects, spiders and occasionally tree sap.',
    reproduction: 'Females build small nests bound with spider silk, incubate the eggs and provide parental care; males do not participate in raising the young.',
    ecologicalRoles: ['pollinator', 'insect predator'],
    humanRelationship: 'A migratory pollinator commonly supported by native flowering plants and responsibly maintained nectar feeders.',
    risks: [],
    conservationStatus: 'Low Concern',
    medicalRelevance: null,
    evidenceState: 'verified_source',
    reviewedAt,
    sources: [
      {
        title: 'Ruby-throated Hummingbird Life History',
        organization: 'Cornell Lab of Ornithology — All About Birds',
        url: 'https://www.allaboutbirds.org/guide/Ruby-throated_Hummingbird/lifehistory',
        sourceType: 'institutional',
        claimScope: 'habitat, diet and nesting',
        reviewedAt
      },
      {
        title: 'Hummingbirds and pollination',
        organization: 'USDA Forest Service',
        url: 'https://www.fs.usda.gov/wildflowers/pollinators/documents/AttractingHummingbirdsFS-1046April2015.pdf',
        sourceType: 'institutional',
        claimScope: 'pollination role including Ruby-throated hummingbirds',
        reviewedAt
      },
      {
        title: 'Ruby-throated hummingbird',
        organization: "Smithsonian's National Zoo and Conservation Biology Institute",
        url: 'https://nationalzoo.si.edu/animals/ruby-throated-hummingbird',
        sourceType: 'institutional',
        claimScope: 'diet, behavior and reproduction',
        reviewedAt
      }
    ]
  },
  {
    id: 'alligator-mississippiensis',
    slug: 'american-alligator',
    scientificName: 'Alligator mississippiensis',
    commonNames: ['American alligator', 'Alligator', 'Gator'],
    rank: 'species',
    group: 'Reptiles',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Reptilia',
      order: 'Crocodilia',
      family: 'Alligatoridae',
      genus: 'Alligator',
      species: 'Alligator mississippiensis'
    },
    habitat: 'Semi-aquatic freshwater and brackish habitats including marshes, swamps, lakes, ponds and slow-moving waterways in the southeastern United States.',
    diet: 'Opportunistic carnivore that preys on aquatic and terrestrial animals available within its habitat.',
    reproduction: 'Females lay eggs in vegetation-based nests and guard nests and young during early development.',
    ecologicalRoles: ['predator', 'ecosystem engineer'],
    humanRelationship: 'A native apex or near-apex wetland predator with major conservation and human-wildlife management significance.',
    risks: ['Wild alligators can seriously injure people; feeding or approaching them increases risk and can alter normal behavior.'],
    conservationStatus: null,
    medicalRelevance: null,
    evidenceState: 'verified_source',
    reviewedAt,
    sources: [
      {
        title: 'American Alligator (Alligator mississippiensis)',
        organization: 'U.S. Fish & Wildlife Service',
        url: 'https://www.fws.gov/species/american-alligator-alligator-mississippiensis',
        sourceType: 'institutional',
        claimScope: 'accepted name, classification, physical description and range context',
        reviewedAt
      },
      {
        title: 'Explore the Taxonomic Tree — American Alligator',
        organization: 'U.S. Fish & Wildlife Service',
        url: 'https://www.fws.gov/taxonomic-tree/39792',
        sourceType: 'taxonomic',
        claimScope: 'taxonomic hierarchy',
        reviewedAt
      }
    ]
  },
  {
    id: 'lithobates-catesbeianus',
    slug: 'american-bullfrog',
    scientificName: 'Lithobates catesbeianus',
    commonNames: ['American bullfrog', 'Bullfrog'],
    rank: 'species',
    group: 'Amphibians',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Amphibia',
      order: 'Anura',
      family: 'Ranidae',
      genus: 'Lithobates',
      species: 'Lithobates catesbeianus'
    },
    habitat: 'Permanent or semi-permanent freshwater habitats such as ponds, lakes, reservoirs, marshes and slow-moving streams.',
    diet: 'Generalist predator that consumes a wide range of invertebrates and small vertebrates it can capture.',
    reproduction: 'Aquatic breeding produces eggs that develop into tadpoles before metamorphosing into terrestrial-aquatic adults.',
    ecologicalRoles: ['predator', 'prey species'],
    humanRelationship: 'Native in eastern North America but widely introduced elsewhere, where it can affect native species and food webs.',
    risks: ['Introduced populations can become invasive and contribute to ecological impacts outside the native range.'],
    conservationStatus: null,
    medicalRelevance: null,
    evidenceState: 'verified_source',
    reviewedAt,
    sources: [
      {
        title: 'American Bullfrog (Lithobates catesbeianus) — Nonindigenous Aquatic Species',
        organization: 'U.S. Geological Survey',
        url: 'https://nas.er.usgs.gov/Queries/FactSheet.aspx?SpeciesID=71',
        sourceType: 'institutional',
        claimScope: 'taxonomy, habitat, feeding ecology, reproduction and introduced impacts',
        reviewedAt
      }
    ]
  },
  {
    id: 'callinectes-sapidus',
    slug: 'blue-crab',
    scientificName: 'Callinectes sapidus',
    commonNames: ['Blue crab', 'Atlantic blue crab'],
    rank: 'species',
    group: 'Crustaceans',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Arthropoda',
      class: 'Malacostraca',
      order: 'Decapoda',
      family: 'Portunidae',
      genus: 'Callinectes',
      species: 'Callinectes sapidus'
    },
    habitat: 'Estuarine and coastal habitats ranging from shallow brackish water and submerged aquatic grass beds to oyster reefs and deeper, saltier water.',
    diet: 'Omnivorous benthic feeder and predator/scavenger consuming mollusks, small animals and organic material.',
    reproduction: 'Sexual reproduction with mating linked to the female molt cycle; females carry developing eggs externally beneath the abdomen.',
    ecologicalRoles: ['predator', 'scavenger', 'prey species'],
    humanRelationship: 'An ecologically important estuarine species and a major commercial and recreational fishery resource.',
    risks: ['Handling live crabs can result in painful pinches from the claws.'],
    conservationStatus: null,
    medicalRelevance: null,
    evidenceState: 'verified_source',
    reviewedAt,
    sources: [
      {
        title: 'Blue Crab',
        organization: 'NOAA Fisheries',
        url: 'https://www.fisheries.noaa.gov/species/blue-crab',
        sourceType: 'institutional',
        claimScope: 'taxonomy, habitat, life history and fishery context',
        reviewedAt
      }
    ]
  },
  {
    id: 'octopus-vulgaris',
    slug: 'common-octopus',
    scientificName: 'Octopus vulgaris',
    commonNames: ['Common octopus'],
    rank: 'species',
    group: 'Mollusks',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Mollusca',
      class: 'Cephalopoda',
      order: 'Octopoda',
      family: 'Octopodidae',
      genus: 'Octopus',
      species: 'Octopus vulgaris'
    },
    habitat: 'Marine benthic habitats where individuals occupy dens, crevices, rocky areas, reefs and other shelter from shallow coastal water across a broad depth range.',
    diet: 'Carnivorous predator that consumes crustaceans, mollusks and other suitable marine prey.',
    reproduction: 'Sexual reproduction; females attach large numbers of eggs to sheltered substrate, brood and clean them, and typically die after the eggs hatch.',
    ecologicalRoles: ['predator', 'prey species'],
    humanRelationship: 'A highly intelligent marine invertebrate important to marine ecology, research and fisheries in parts of its range.',
    risks: ['Wild octopuses should be observed without handling; defensive bites are possible.'],
    conservationStatus: null,
    medicalRelevance: null,
    evidenceState: 'curated_reference',
    reviewedAt,
    sources: [
      {
        title: 'Octopus vulgaris Cuvier, 1797',
        organization: 'World Register of Marine Species (WoRMS)',
        url: 'https://www.marinespecies.org/aphia.php?id=140605&p=taxdetails',
        sourceType: 'taxonomic',
        claimScope: 'accepted scientific name and taxonomic status',
        reviewedAt
      },
      {
        title: 'Octopus vulgaris',
        organization: 'Animal Diversity Web, University of Michigan Museum of Zoology',
        url: 'https://animaldiversity.org/accounts/Octopus_vulgaris/',
        sourceType: 'reference',
        claimScope: 'habitat, behavior and reproduction',
        reviewedAt
      }
    ]
  },
  {
    id: 'lumbricus-terrestris',
    slug: 'common-earthworm',
    scientificName: 'Lumbricus terrestris',
    commonNames: ['Common earthworm', 'Nightcrawler', 'Dew worm'],
    rank: 'species',
    group: 'Annelids',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Annelida',
      class: 'Clitellata',
      order: 'Haplotaxida',
      family: 'Lumbricidae',
      genus: 'Lumbricus',
      species: 'Lumbricus terrestris'
    },
    habitat: 'Terrestrial soils where permanent vertical burrows connect deeper mineral soil to surface litter.',
    diet: 'Detritivore that pulls partially decomposed surface litter and other organic matter into its burrow.',
    reproduction: 'Sexual reproduction between hermaphroditic individuals, followed by production of cocoons containing developing young.',
    ecologicalRoles: ['detritivore', 'nutrient recycling', 'soil mixing', 'soil aeration'],
    humanRelationship: 'Can improve soil structure and nutrient cycling in ecosystems with earthworm history, but introduced populations can disrupt litter layers and nutrient dynamics in previously earthworm-free northern forests.',
    risks: ['Ecological impacts are possible when introduced outside the native or historically earthworm-influenced range.'],
    conservationStatus: null,
    medicalRelevance: null,
    evidenceState: 'verified_source',
    reviewedAt,
    sources: [
      {
        title: 'Earthworms',
        organization: 'University of Illinois — Soil Quality for Environmental Health',
        url: 'https://soilquality.nres.illinois.edu/earthworms/',
        sourceType: 'institutional',
        claimScope: 'soil structure, decomposition, nutrient cycling and nonnative impacts',
        reviewedAt
      },
      {
        title: 'Earthworm Information',
        organization: 'UC Davis Sustainable Agriculture Research & Education Program',
        url: 'https://sarep.ucdavis.edu/are/ecosystem/earthworm',
        sourceType: 'institutional',
        claimScope: 'anecic ecology and Lumbricus terrestris detritivore role',
        reviewedAt
      },
      {
        title: 'Lumbricus terrestris Linnaeus, 1758',
        organization: 'GBIF / Integrated Taxonomic Information System',
        url: 'https://www.gbif.org/es/dataset/9ca92552-f23a-41a8-a140-01abaa31c931/taxon/977384',
        sourceType: 'taxonomic',
        claimScope: 'accepted name and common names',
        reviewedAt
      }
    ]
  },
  {
    id: 'asterias-rubens',
    slug: 'common-starfish',
    scientificName: 'Asterias rubens',
    commonNames: ['Common starfish', 'Common sea star'],
    rank: 'species',
    group: 'Echinoderms',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Echinodermata',
      class: 'Asteroidea',
      order: 'Forcipulatida',
      family: 'Asteriidae',
      genus: 'Asterias',
      species: 'Asterias rubens'
    },
    habitat: 'Marine intertidal and subtidal habitats on rock, sand, gravel, mud flats and mussel beds.',
    diet: 'Carnivorous benthic predator that commonly consumes bivalves such as mussels and clams as well as other invertebrates.',
    reproduction: 'Sexual spawning releases gametes into seawater; development includes a planktonic larval phase before settlement and metamorphosis.',
    ecologicalRoles: ['benthic predator', 'prey species'],
    humanRelationship: 'A familiar north-east Atlantic sea star that can influence shellfish beds through predation.',
    risks: [],
    conservationStatus: null,
    medicalRelevance: null,
    evidenceState: 'curated_reference',
    reviewedAt,
    sources: [
      {
        title: 'Common starfish (Asterias rubens)',
        organization: 'Marine Life Information Network (MarLIN)',
        url: 'https://www.marlin.ac.uk/species/detail/1194',
        sourceType: 'reference',
        claimScope: 'distribution, habitat and ecology',
        reviewedAt
      },
      {
        title: 'Asterias rubens',
        organization: 'Animal Diversity Web, University of Michigan Museum of Zoology',
        url: 'https://animaldiversity.org/accounts/Asterias_rubens/',
        sourceType: 'reference',
        claimScope: 'habitat and feeding ecology',
        reviewedAt
      },
      {
        title: 'Asterias rubens Linnaeus, 1758',
        organization: 'World Register of Marine Species (WoRMS)',
        url: 'https://www.marinespecies.org/aphia.php?p=taxdetails&id=123776',
        sourceType: 'taxonomic',
        claimScope: 'accepted taxonomic identity',
        reviewedAt
      }
    ]
  },
  {
    id: 'aurelia-aurita',
    slug: 'moon-jelly',
    scientificName: 'Aurelia aurita',
    commonNames: ['Moon jelly', 'Moon jellyfish'],
    rank: 'species',
    group: 'Cnidarians',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Cnidaria',
      class: 'Scyphozoa',
      order: 'Semaeostomeae',
      family: 'Ulmaridae',
      genus: 'Aurelia',
      species: 'Aurelia aurita'
    },
    habitat: 'Marine and brackish coastal waters spanning surface and deeper pelagic zones, with environmental tolerance varying by temperature and salinity.',
    diet: 'Carnivorous planktivore that captures plankton, copepods, mollusks, fish eggs and other small organisms with tentacles and oral arms.',
    reproduction: 'The life cycle alternates between sexually reproducing medusae and attached polyps that can reproduce asexually and release juvenile ephyrae.',
    ecologicalRoles: ['planktivore', 'predator', 'prey species'],
    humanRelationship: 'A common jellyfish used in education and aquarium displays and an important participant in coastal food webs.',
    risks: ['Possesses stinging cells; contact can irritate sensitive skin even though effects are usually milder than many other jellyfish species.'],
    conservationStatus: null,
    medicalRelevance: null,
    evidenceState: 'curated_reference',
    reviewedAt,
    sources: [
      {
        title: 'Aurelia aurita (Moon jellyfish)',
        organization: 'Animal Diversity Web, University of Michigan Museum of Zoology',
        url: 'https://animaldiversity.org/accounts/Aurelia_aurita/',
        sourceType: 'reference',
        claimScope: 'habitat, development, reproduction, diet and predators',
        reviewedAt
      },
      {
        title: 'Aurelia aurita (Linnaeus, 1758)',
        organization: 'World Register of Marine Species (WoRMS)',
        url: 'https://www.marinespecies.org/aphia.php?id=135306&p=taxdetails',
        sourceType: 'taxonomic',
        claimScope: 'accepted scientific name and marine taxonomic status',
        reviewedAt
      }
    ]
  }
];

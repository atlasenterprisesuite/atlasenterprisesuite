export type TransportMaturity = 'operational' | 'limited' | 'pilot' | 'concept';
export type TransportDomain = 'human' | 'animal' | 'road' | 'rail' | 'water' | 'air' | 'cable' | 'underground' | 'space' | 'pipeline' | 'logistics';

export interface TransportMode {
  id: string;
  name: string;
  domain: TransportDomain;
  maturity: TransportMaturity;
  era: string;
  description: string;
}
export const TRANSPORT_MATURITY_LABELS: Record<TransportMaturity, string> = {
  operational: 'Operativo', limited: 'Operación limitada', pilot: 'Piloto / demostración', concept: 'Concepto'
};
export const WORLD_TRANSPORT_MODES: readonly TransportMode[] = [
  { id:'walking', name:'Caminata', domain:'human', maturity:'operational', era:'Prehistoria', description:'Movilidad humana sin vehículo.' },
  { id:'bicycle', name:'Bicicleta', domain:'human', maturity:'operational', era:'Siglo XIX', description:'Movilidad personal impulsada por fuerza humana.' },
  { id:'horse', name:'Caballo de transporte', domain:'animal', maturity:'operational', era:'Antigüedad', description:'Transporte animal aún utilizado en contextos específicos.' },
  { id:'car', name:'Automóvil', domain:'road', maturity:'operational', era:'Siglo XIX', description:'Transporte terrestre individual motorizado.' },
  { id:'bus', name:'Autobús', domain:'road', maturity:'operational', era:'Siglo XIX', description:'Transporte colectivo terrestre.' },
  { id:'robotaxi', name:'Robotaxi geocercado', domain:'road', maturity:'limited', era:'Siglo XXI', description:'Servicio automatizado restringido a zonas y condiciones autorizadas.' },
  { id:'train', name:'Ferrocarril', domain:'rail', maturity:'operational', era:'Siglo XIX', description:'Transporte guiado de pasajeros y carga.' },
  { id:'metro', name:'Metro urbano', domain:'rail', maturity:'operational', era:'Siglo XIX', description:'Red ferroviaria urbana de alta capacidad.' },
  { id:'maglev', name:'Tren de levitación magnética', domain:'rail', maturity:'limited', era:'Siglo XX', description:'Operación comercial restringida a corredores específicos.' },
  { id:'ferry', name:'Ferri', domain:'water', maturity:'operational', era:'Antigüedad', description:'Transporte de personas y vehículos sobre agua.' },
  { id:'container-ship', name:'Portacontenedores', domain:'water', maturity:'operational', era:'Siglo XX', description:'Transporte marítimo de mercancías normalizadas.' },
  { id:'airplane', name:'Avión comercial', domain:'air', maturity:'operational', era:'Siglo XX', description:'Transporte aéreo de personas y carga.' },
  { id:'delivery-drone', name:'Dron de reparto', domain:'air', maturity:'limited', era:'Siglo XXI', description:'Distribución aérea restringida por cobertura y autorizaciones.' },
  { id:'evtol', name:'Aerotaxi eVTOL', domain:'air', maturity:'pilot', era:'Siglo XXI', description:'Categoría en certificación, demostración o despliegue según fabricante y jurisdicción; no implica servicio general.' },
  { id:'cable-car', name:'Teleférico', domain:'cable', maturity:'operational', era:'Siglo XIX', description:'Transporte suspendido por cable.' },
  { id:'elevator', name:'Ascensor', domain:'cable', maturity:'operational', era:'Siglo XIX', description:'Movilidad vertical en edificios e infraestructura.' },
  { id:'subway-tunnel', name:'Transporte en túnel', domain:'underground', maturity:'operational', era:'Siglo XIX', description:'Infraestructura subterránea para transporte guiado o vial.' },
  { id:'rocket', name:'Cohete espacial', domain:'space', maturity:'operational', era:'Siglo XX', description:'Lanzamiento de carga o tripulaciones al espacio.' },
  { id:'space-elevator', name:'Ascensor espacial', domain:'space', maturity:'concept', era:'Futuro hipotético', description:'Concepto sin sistema de transporte operativo.' },
  { id:'pipeline', name:'Oleoducto y gasoducto', domain:'pipeline', maturity:'operational', era:'Siglo XIX', description:'Transporte de fluidos mediante infraestructura tubular.' },
  { id:'agv', name:'Vehículo logístico AGV', domain:'logistics', maturity:'operational', era:'Siglo XX', description:'Transporte automatizado de materiales en instalaciones.' },
  { id:'hyperloop', name:'Hyperloop de pasajeros', domain:'rail', maturity:'concept', era:'Siglo XXI', description:'Concepto de transporte tubular de alta velocidad sin red comercial masiva operativa.' }
];
export function filterTransportModes(domain: string, maturity: string, query: string): TransportMode[] {
  const term = query.trim().toLocaleLowerCase('es');
  return WORLD_TRANSPORT_MODES.filter(mode =>
    (domain === 'all' || mode.domain === domain) &&
    (maturity === 'all' || mode.maturity === maturity) &&
    (!term || [mode.name,mode.description,mode.era].some(value => value.toLocaleLowerCase('es').includes(term)))
  );
}

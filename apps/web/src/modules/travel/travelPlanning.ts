/** Provider-neutral trip planning. No inventory, booking, charge, or live availability is implied. */
export const TRAVEL_CATEGORIES = [
  { id: 'hotel', label: 'Hoteles', search: 'hoteles alojamiento precios' },
  { id: 'stay', label: 'Casas y estadías', search: 'alquiler vacacional apartamentos estadias' },
  { id: 'flight', label: 'Vuelos', search: 'vuelos vuelos economicos' },
  { id: 'car', label: 'Autos de alquiler', search: 'alquiler de autos coches renta' },
  { id: 'ground', label: 'Trenes y buses', search: 'boletos tren autobus bus' },
  { id: 'transfer', label: 'Traslados', search: 'traslado aeropuerto taxi transporte' },
  { id: 'experience', label: 'Actividades', search: 'tours excursiones entradas actividades' },
  { id: 'restaurant', label: 'Restaurantes', search: 'restaurantes reservas mesa' },
  { id: 'insurance', label: 'Seguro de viaje', search: 'seguro de viaje cotizacion' },
  { id: 'package', label: 'Paquetes', search: 'paquetes vuelo hotel auto vacaciones' }
] as const;

export type TravelCategory = (typeof TRAVEL_CATEGORIES)[number]['id'];

export type PlannedService = {
  id: string;
  category: TravelCategory;
  title: string;
  notes: string;
  estimatedCost?: number;
};

export type TripPlan = {
  destination: string;
  checkIn: string;
  checkOut: string;
  travelers: number;
  budget?: number;
  services: PlannedService[];
};

function dateNumber(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const stamp = Date.parse(value + 'T00:00:00.000Z');
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== value) return null;
  return stamp;
}

export function tripNights(plan: Pick<TripPlan, 'checkIn' | 'checkOut'>): number | null {
  const start = dateNumber(plan.checkIn);
  const end = dateNumber(plan.checkOut);
  return start === null || end === null ? null : (end - start) / 86400000;
}

export function validateTripPlan(plan: TripPlan): string | null {
  if (!plan.destination.trim() || plan.destination.trim().length > 160) return 'Escribe un destino válido (máximo 160 caracteres).';
  const nights = tripNights(plan);
  if (nights === null || nights < 1 || nights > 365) return 'Selecciona fechas válidas: la salida debe ser posterior a la entrada (máximo 365 noches).';
  if (!Number.isInteger(plan.travelers) || plan.travelers < 1 || plan.travelers > 20) return 'Selecciona entre 1 y 20 viajeros.';
  if (plan.budget !== undefined && (!Number.isFinite(plan.budget) || plan.budget <= 0 || plan.budget > 100000000)) return 'Introduce un presupuesto válido.';
  if (plan.services.length > 100) return 'Máximo 100 opciones por viaje.';
  for (const service of plan.services) {
    if (!TRAVEL_CATEGORIES.some((category) => category.id === service.category)) return 'Categoría de servicio inválida.';
    if (!service.title.trim() || service.title.length > 160 || service.notes.length > 2000) return 'Revisa las opciones del itinerario.';
    if (service.estimatedCost !== undefined && (!Number.isFinite(service.estimatedCost) || service.estimatedCost < 0 || service.estimatedCost > 100000000)) return 'El costo estimado no es válido.';
  }
  return null;
}

export function travelSearchUrl(plan: TripPlan, category: TravelCategory): string {
  const invalid = validateTripPlan(plan);
  if (invalid) throw new Error(invalid);
  const selected = TRAVEL_CATEGORIES.find((entry) => entry.id === category);
  if (!selected) throw new Error('Categoría no válida');
  const query = selected.search + ' ' + plan.destination.trim() + ' ' + plan.checkIn + ' ' + plan.checkOut + ' ' + plan.travelers + ' personas';
  // Search engine only. Does not supply inventory, price quotes, bookings or affiliate attribution.
  return 'https://www.google.com/search?q=' + encodeURIComponent(query);
}

/** Load only our documented, bounded, unconfirmed plan format. No network or storage writes. */
export function parseTravelDraftJson(raw: string): TripPlan {
  if (raw.length > 131072) throw new Error('El archivo supera el límite de 128 KB.');
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error('El archivo JSON no es válido.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Formato de viaje inválido.');
  const value = data as Record<string, unknown>;
  if (value.schema !== 'atlas.travel.plan.v1' || value.status !== 'draft_unconfirmed') throw new Error('Este archivo no es un borrador ATLAS Travel compatible.');
  if (typeof value.destination !== 'string' || typeof value.checkIn !== 'string' || typeof value.checkOut !== 'string' || typeof value.travelers !== 'number' || (value.budget !== undefined && typeof value.budget !== 'number')) throw new Error('Los datos básicos del viaje son inválidos.');
  if (!Array.isArray(value.services) || value.services.length > 100) throw new Error('La lista de opciones es inválida.');
  const services: PlannedService[] = value.services.map((item: unknown, index: number) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Opción de viaje inválida.');
    const service = item as Record<string, unknown>;
    if (typeof service.category !== 'string' || !TRAVEL_CATEGORIES.some((entry) => entry.id === service.category) || typeof service.title !== 'string' || typeof service.notes !== 'string' || (service.estimatedCost !== undefined && typeof service.estimatedCost !== 'number')) throw new Error('La opción del viaje no tiene un formato válido.');
    return {
      id: 'imported-' + index,
      category: service.category as TravelCategory,
      title: service.title,
      notes: service.notes,
      estimatedCost: service.estimatedCost as number | undefined
    };
  });
  const plan: TripPlan = {
    destination: value.destination,
    checkIn: value.checkIn,
    checkOut: value.checkOut,
    travelers: value.travelers,
    budget: value.budget as number | undefined,
    services
  };
  const error = validateTripPlan(plan);
  if (error) throw new Error(error);
  return plan;
}

/** Security-safe unique draft identifiers; do not fall back to Math.random. */
export function createTravelId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\n|\r/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

export function tripCalendarIcs(plan: TripPlan, now = new Date()): string {
  const invalid = validateTripPlan(plan);
  if (invalid) throw new Error(invalid);
  const services = plan.services.map((service) => {
    const category = TRAVEL_CATEGORIES.find((entry) => entry.id === service.category);
    const cost = service.estimatedCost === undefined ? '' : ' (estimado USD ' + service.estimatedCost.toFixed(2) + ')';
    return '- ' + (category?.label || '') + ': ' + service.title + cost + (service.notes ? ' / ' + service.notes : '');
  });
  const details = [
    'PLANIFICACIÓN ÚNICAMENTE. No existe reserva, billete ni pago confirmado.',
    'Destino: ' + plan.destination.trim(),
    'Viajeros: ' + plan.travelers,
    'Presupuesto orientativo: ' + (plan.budget === undefined ? 'No indicado' : 'USD ' + plan.budget.toFixed(2)),
    'Opciones por confirmar:',
    ...(services.length ? services : ['Sin opciones añadidas'])
  ].join('\n');
  const instant = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uid = 'atlas-travel-' + instant + '-' + createTravelId() + '@atlas.local';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ATLAS Enterprise Suite//Travel Planner//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + instant,
    'DTSTART;VALUE=DATE:' + plan.checkIn.replace(/-/g, ''),
    'DTEND;VALUE=DATE:' + plan.checkOut.replace(/-/g, ''),
    'SUMMARY:' + escapeIcs('Plan de viaje SIN CONFIRMAR: ' + plan.destination.trim()),
    'DESCRIPTION:' + escapeIcs(details),
    'STATUS:TENTATIVE',
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}

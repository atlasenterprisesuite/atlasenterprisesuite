import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  TRAVEL_CATEGORIES,
  parseTravelDraftJson,
  travelSearchUrl,
  tripCalendarIcs,
  tripNights,
  validateTripPlan,
  type PlannedService,
  type TravelCategory,
  type TripPlan
} from './travelPlanning';
import './travel.css';

function downloadFile(content: string, filename: string, mediaType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TravelPlannerPage() {
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [travelers, setTravelers] = useState('1');
  const [budget, setBudget] = useState('');
  const [category, setCategory] = useState<TravelCategory>('hotel');
  const [services, setServices] = useState<PlannedService[]>([]);
  const [optionTitle, setOptionTitle] = useState('');
  const [optionNotes, setOptionNotes] = useState('');
  const [optionCost, setOptionCost] = useState('');
  const [optionError, setOptionError] = useState('');
  const [importError, setImportError] = useState('');

  const plan: TripPlan = {
    destination,
    checkIn,
    checkOut,
    travelers: Number(travelers),
    budget: budget.trim() ? Number(budget) : undefined,
    services
  };
  const planError = validateTripPlan(plan);
  const nights = tripNights(plan);
  const total = services.reduce((sum, service) => sum + (service.estimatedCost || 0), 0);
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const chosenCategory = TRAVEL_CATEGORIES.find((entry) => entry.id === category);

  const openSearch = () => {
    if (planError) return;
    // Explicit user action opens a public search. No affiliate or live inventory integration.
    window.open(travelSearchUrl(plan, category), '_blank', 'noopener,noreferrer');
  };

  const addOption = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = optionTitle.trim();
    if (!title || title.length > 160) {
      setOptionError('Describe la opción en 1 a 160 caracteres.');
      return;
    }
    if (optionNotes.length > 2000) {
      setOptionError('Las notas no pueden superar 2.000 caracteres.');
      return;
    }
    const value = optionCost.trim() ? Number(optionCost) : undefined;
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100000000)) {
      setOptionError('El costo estimado debe ser un número válido mayor o igual a cero.');
      return;
    }
    if (services.length >= 100) {
      setOptionError('Máximo 100 opciones.');
      return;
    }
    setServices((current) => [...current, {
      id: String(Date.now()) + '-' + String(Math.random()).slice(2),
      category,
      title,
      notes: optionNotes.trim(),
      estimatedCost: value
    }]);
    setOptionTitle('');
    setOptionNotes('');
    setOptionCost('');
    setOptionError('');
  };

  const importDraft = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 131072) throw new Error('El archivo supera el límite de 128 KB.');
      const restored = parseTravelDraftJson(await file.text());
      setDestination(restored.destination);
      setCheckIn(restored.checkIn);
      setCheckOut(restored.checkOut);
      setTravelers(String(restored.travelers));
      setBudget(restored.budget === undefined ? '' : String(restored.budget));
      setServices(restored.services);
      setOptionError('');
      setImportError('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'No se pudo abrir el archivo.');
    }
  };

  const exportCalendar = () => {
    if (planError) return;
    downloadFile(tripCalendarIcs(plan), 'atlas-viaje-pendiente.ics', 'text/calendar;charset=utf-8');
  };

  const exportDraft = () => {
    if (planError) return;
    downloadFile(
      JSON.stringify({
        schema: 'atlas.travel.plan.v1',
        status: 'draft_unconfirmed',
        exportedAt: new Date().toISOString(),
        ...plan
      }, null, 2),
      'atlas-plan-viaje.json',
      'application/json;charset=utf-8'
    );
  };

  return (
    <section className="page-stack atlas-travel" aria-labelledby="travel-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Travel &amp; Stay · Planificador</p>
        <h1 id="travel-title">Viaja, compara y organiza en un solo lugar</h1>
        <p>Hoteles, estadías, vuelos, autos, transporte y experiencias. Busca opciones en la web y reúne tu propio itinerario sin inventar precios ni reservas.</p>
      </header>

      <div className="notice strong" role="status">
        <strong>Modo planificación.</strong> La búsqueda abre resultados públicos de Google; ATLAS no recibe tarifas o disponibilidad verificadas.
        Añadir una opción, exportar el plan o descargar el calendario <strong>no reserva ni paga</strong> ningún servicio.
      </div>

      <div className="travel-categories" aria-label="Tipo de servicio">
        {TRAVEL_CATEGORIES.map((entry) => (
          <button key={entry.id} type="button" aria-pressed={category === entry.id}
            className={category === entry.id ? 'travel-category active' : 'travel-category'}
            onClick={() => { setCategory(entry.id); setOptionError(''); }}>
            {entry.label}
          </button>
        ))}
      </div>

      <div className="travel-panel">
        <h2>Buscar {chosenCategory?.label.toLowerCase()}</h2>
        <div className="travel-form-grid">
          <label className="travel-field travel-destination">Destino
            <input value={destination} maxLength={160} onChange={(event) => setDestination(event.target.value)}
              placeholder="Ciudad, región o país" autoComplete="off" />
          </label>
          <label className="travel-field">Entrada / salida
            <input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} aria-label="Fecha de inicio" />
          </label>
          <label className="travel-field">Hasta
            <input type="date" value={checkOut} min={checkIn || undefined} onChange={(event) => setCheckOut(event.target.value)} aria-label="Fecha final" />
          </label>
          <label className="travel-field">Viajeros
            <input type="number" min={1} max={20} step={1} value={travelers} onChange={(event) => setTravelers(event.target.value)} />
          </label>
          <label className="travel-field">Presupuesto total, USD (opcional)
            <input type="number" min={1} step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Sin límite establecido" />
          </label>
        </div>
        <p className="travel-helper">
          {nights !== null && nights > 0 ? nights + (nights === 1 ? ' noche' : ' noches') : 'Selecciona las fechas del viaje'} · Los precios dependen del proveedor y deben verificarse antes de pagar.
        </p>
        {planError ? <p className="travel-validation" role="alert">{planError}</p> : null}
        <div className="travel-actions">
          <button type="button" className="travel-primary" disabled={Boolean(planError)} onClick={openSearch}>Buscar en la web <span aria-hidden="true">↗</span></button>
          <span>Se abrirá una búsqueda externa de {chosenCategory?.label.toLowerCase()}; las fechas y el destino se enviarán al buscador.</span>
        </div>
      </div>

      <div className="travel-duo">
        <div className="travel-panel">
          <h2>Agregar una opción a tu itinerario</h2>
          <p className="travel-helper">Guarda manualmente nombres y estimaciones de las opciones que encuentres. No son reservas confirmadas.</p>
          <form onSubmit={addOption} className="travel-option-form">
            <label className="travel-field">Nombre del alojamiento, vuelo o servicio
              <input value={optionTitle} maxLength={160} onChange={(event) => setOptionTitle(event.target.value)} placeholder={'Ej.: ' + (chosenCategory?.label || 'Servicio') + ' opción 1'} />
            </label>
            <label className="travel-field">Costo estimado (USD, opcional)
              <input type="number" min={0} step="0.01" value={optionCost} onChange={(event) => setOptionCost(event.target.value)} placeholder="Precio consultado por ti" />
            </label>
            <label className="travel-field">Notas (opcional)
              <textarea maxLength={2000} value={optionNotes} onChange={(event) => setOptionNotes(event.target.value)} placeholder="Proveedor, enlace, ubicación, condiciones de cancelación…" rows={3} />
            </label>
            {optionError ? <p className="travel-validation" role="alert">{optionError}</p> : null}
            <button className="travel-secondary" type="submit">Añadir opción pendiente</button>
          </form>
        </div>

        <div className="travel-panel travel-itinerary">
          <div className="travel-itinerary-heading">
            <h2>Mi viaje</h2>
            <span>{services.length} opciones</span>
          </div>
          <p className="travel-helper">Opciones añadidas por ti. No hay inventario, pagos, confirmaciones ni retenciones de habitación.</p>
          {services.length ? (
            <ul className="travel-options">
              {services.map((service) => (
                <li key={service.id}>
                  <div className="travel-option-heading">
                    <strong>{service.title}</strong>
                    <button type="button" onClick={() => setServices((current) => current.filter((item) => item.id !== service.id))} aria-label={'Quitar ' + service.title}>Quitar</button>
                  </div>
                  <small>{TRAVEL_CATEGORIES.find((entry) => entry.id === service.category)?.label} · Pendiente de confirmar</small>
                  {service.notes ? <p>{service.notes}</p> : null}
                  {service.estimatedCost !== undefined ? <span>Estimado: {currency.format(service.estimatedCost)}</span> : null}
                </li>
              ))}
            </ul>
          ) : <p className="travel-empty">Aún no has añadido opciones. Puedes buscar por categoría y registrar las que quieras comparar.</p>}
          <div className="travel-cost">
            <span>Suma de costos ingresados (no cotización)</span>
            <strong>{currency.format(total)}</strong>
            {plan.budget !== undefined && !planError ? (
              <small>{total > plan.budget ? 'Las estimaciones superan tu presupuesto.' : 'Presupuesto restante orientativo: ' + currency.format(plan.budget - total)}</small>
            ) : null}
          </div>
          <div className="travel-actions travel-export">
            <button type="button" className="travel-primary" disabled={Boolean(planError)} onClick={exportCalendar}>Agendar plan (.ics)</button>
            <button type="button" className="travel-secondary" disabled={Boolean(planError)} onClick={exportDraft}>Guardar plan (.json)</button>
          </div>
          <label className="travel-field travel-import">Recuperar plan guardado (.json)
            <input type="file" accept=".json,application/json" aria-label="Importar plan ATLAS Travel"
              onChange={(event) => { void importDraft(event.target.files?.[0]); event.target.value = ''; }} />
          </label>
          {importError ? <p className="travel-validation" role="alert">{importError}</p> : null}
          <p className="travel-helper">El archivo se lee localmente y se valida antes de restaurar tus opciones. No se sube a ningún servidor.</p>
          <p className="travel-helper">El archivo .ics añade un evento tentativo al calendario que elijas; no sincroniza automáticamente ni confirma reservaciones. Los datos solo permanecen en memoria mientras esta página siga abierta. Descarga el plan antes de salir.</p>
        </div>
      </div>

      <div className="travel-panel">
        <h2>Servicios relacionados dentro de ATLAS</h2>
        <div className="travel-related">
          <Link to="/hospitality/overview"><strong>Hospitality</strong><span>Operaciones hoteleras y propiedades</span></Link>
          <Link to="/ride"><strong>Ride OS</strong><span>Movilidad y transporte terrestre</span></Link>
          <Link to="/mobility/aviation"><strong>Aviation</strong><span>Exploración y movilidad aérea</span></Link>
          <Link to="/events"><strong>Events</strong><span>Experiencias y eventos</span></Link>
        </div>
      </div>
    </section>
  );
}

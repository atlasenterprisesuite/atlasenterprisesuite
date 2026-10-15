import { useState } from 'react';
import { Link } from 'react-router-dom';

type Reservation = { hotel: string; confirmation: string; checkIn: string; checkOut: string };
const destinations = [
  { country: 'United States', region: 'Florida', city: 'Orlando', attractions: ['ICON Park', 'Universal Orlando Resort', 'Walt Disney World Resort', 'Lake Eola Park'] },
  { country: 'United States', region: 'New York', city: 'New York City', attractions: ['Central Park', 'Metropolitan Museum of Art', 'Statue of Liberty'] },
  { country: 'Venezuela', region: 'Distrito Capital', city: 'Caracas', attractions: ['Parque Nacional Waraira Repano', 'Plaza Bolívar', 'Museo de Bellas Artes'] },
  { country: 'Spain', region: 'Madrid', city: 'Madrid', attractions: ['Museo del Prado', 'Parque del Retiro', 'Palacio Real'] }
];
export function TravelExperiencesPage() {
  const [country, setCountry] = useState('United States');
  const [region, setRegion] = useState('Florida');
  const [query, setQuery] = useState('');
  const [reservation, setReservation] = useState<Reservation>({ hotel: '', confirmation: '', checkIn: '', checkOut: '' });
  const [saved, setSaved] = useState<Reservation | null>(null);
  const countries = [...new Set(destinations.map(d => d.country))];
  const regions = [...new Set(destinations.filter(d => d.country === country).map(d => d.region))];
  const matches = destinations.filter(d => d.country === country && d.region === region && [d.city, ...d.attractions].some(x => x.toLowerCase().includes(query.toLowerCase())));
  return <main className="page-stack" style={{maxWidth: 1080, margin: '0 auto', padding: 'clamp(1rem, 4vw, 2rem)'}}>
    <header className="page-header"><p className="eyebrow">ATLAS · Travel & Experiences</p><h1>Planifica tu próximo viaje</h1><p>Reservas, destinos y atracciones en un mismo espacio. Vista inicial de exploración; los precios y la disponibilidad requieren proveedores conectados.</p></header>
    <section className="module-grid" aria-label="Áreas de viaje">
      <article className="module-card enabled"><strong>Mis reservas</strong><p>Consulta los datos que agregues durante esta sesión.</p></article>
      <article className="module-card enabled"><strong>Explorar destinos</strong><p>Filtra por país, región y atracción.</p></article>
      <article className="module-card enabled"><strong>Movilidad</strong><p><Link to="/gps">Abrir ATLAS GPS 4D</Link></p></article>
    </section>
    <section className="panel"><h2>Registrar reserva</h2><p>Los datos se conservan solo en esta pestaña mientras la página esté abierta. No se envían a un servidor ni constituyen una reserva nueva.</p>
      <form onSubmit={e => {e.preventDefault(); if (reservation.hotel.trim() && reservation.checkIn && reservation.checkOut && reservation.checkOut >= reservation.checkIn) setSaved({...reservation}); }} style={{display:'grid',gap:12}}>
        <label>Hotel<input required value={reservation.hotel} onChange={e=>setReservation({...reservation,hotel:e.target.value})}/></label>
        <label>Confirmación (opcional)<input value={reservation.confirmation} onChange={e=>setReservation({...reservation,confirmation:e.target.value})}/></label>
        <label>Entrada<input type="date" required value={reservation.checkIn} onChange={e=>setReservation({...reservation,checkIn:e.target.value})}/></label>
        <label>Salida<input type="date" required min={reservation.checkIn} value={reservation.checkOut} onChange={e=>setReservation({...reservation,checkOut:e.target.value})}/></label>
        <button type="submit">Guardar en esta sesión</button>
      </form>
      {saved && <div role="status"><h3>Reserva registrada en esta sesión</h3><p>{saved.hotel} · {saved.checkIn} – {saved.checkOut}</p><button type="button" onClick={()=>setSaved(null)}>Quitar de la sesión</button></div>}
    </section>
    <section className="panel"><h2>Destinos y atracciones</h2>
      <div style={{display:'grid',gap:12}}>
        <label>País<select value={country} onChange={e=>{const c=e.target.value;setCountry(c);setRegion(destinations.find(d=>d.country===c)?.region ?? '');}}>{countries.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Estado o región<select value={region} onChange={e=>setRegion(e.target.value)}>{regions.map(r=><option key={r}>{r}</option>)}</select></label>
        <label>Buscar ciudad o atracción<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Museos, parques, lugares…"/></label>
      </div>
      {matches.length ? matches.map(d=><article key={d.city}><h3>{d.city}</h3><ul>{d.attractions.filter(a=>!query || a.toLowerCase().includes(query.toLowerCase()) || d.city.toLowerCase().includes(query.toLowerCase())).map(a=><li key={a}>{a}</li>)}</ul></article>) : <p>No hay coincidencias en el catálogo inicial.</p>}
      <p className="notice">Catálogo ilustrativo, no inventario global completo. Horarios, entradas, accesibilidad y precios deben verificarse con fuentes oficiales.</p>
    </section>
  </main>;
}

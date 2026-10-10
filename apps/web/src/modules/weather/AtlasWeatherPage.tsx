import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  describeWeather, fetchNwsAlerts, fetchNwsObservation, fetchWeatherForecast, formatTemperature,
  nextWeatherHour, nwsCoverageEligible, type WeatherAlert, type WeatherForecast, type WeatherKind, type WeatherObservation
} from './weatherDomain';
import './weather.css';

type WeatherPlace = { label: string; lat: number; lon: number; origin: 'preset' | 'gps' };
type FetchState = 'loading' | 'ready' | 'error';

const CITIES: WeatherPlace[] = [
  { label: 'Orlando, FL', lat: 28.5384, lon: -81.3789, origin: 'preset' },
  { label: 'Miami, FL', lat: 25.7617, lon: -80.1918, origin: 'preset' },
  { label: 'New York, NY', lat: 40.7128, lon: -74.0060, origin: 'preset' },
  { label: 'Caracas, VE', lat: 10.4806, lon: -66.9036, origin: 'preset' },
  { label: 'Madrid, ES', lat: 40.4168, lon: -3.7038, origin: 'preset' },
  { label: 'Tokyo, JP', lat: 35.6762, lon: 139.6503, origin: 'preset' }
];

function localTime(value: string): string {
  return new Date(value).toLocaleString('es', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function dayLabel(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('es', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
}

const GLYPHS: Record<WeatherKind, string> = {
  sun: '☀', cloud: '☁', rain: '☂', snow: '❄', storm: 'ϟ', fog: '≋', unknown: '◌'
};

function WeatherScene({ kind }: { kind: WeatherKind }) {
  return <div className={`weather-scene weather-scene--${kind}`} aria-hidden="true">
    <div className="weather-scene-orb" />
    <div className="weather-scene-cloud weather-scene-cloud--front" />
    <div className="weather-scene-cloud weather-scene-cloud--back" />
    {(kind === 'rain' || kind === 'storm') && <div className="weather-scene-precip">│ │ │ │ │ │ │ │ │ │</div>}
    {kind === 'snow' && <div className="weather-scene-precip">✻ · ✻ · ✻ · ✻ · ✻</div>}
    {kind === 'storm' && <div className="weather-scene-flash">ϟ</div>}
  </div>;
}

export function AtlasWeatherPage() {
  const [place, setPlace] = useState<WeatherPlace>(CITIES[0]);
  const [unit, setUnit] = useState<'C' | 'F'>('F');
  const [refreshCycle, setRefreshCycle] = useState(0);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [forecastState, setForecastState] = useState<FetchState>('loading');
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [observation, setObservation] = useState<WeatherObservation | null>(null);
  const [observationState, setObservationState] = useState<FetchState>('loading');
  const [observationError, setObservationError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [alertsState, setAlertsState] = useState<FetchState>('loading');
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [gpsMessage, setGpsMessage] = useState('');
  const eligible = nwsCoverageEligible(place.lat, place.lon);

  // Pull periodically, but never bypass the source's HTTP Expires cache boundary.
  useEffect(() => {
    const interval = window.setInterval(() => setRefreshCycle(value => value + 1), 15 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setForecast(null);
    setForecastState('loading');
    setForecastError(null);
    setAlerts([]);
    setObservation(null);
    setObservationError(null);
    setObservationState(eligible ? 'loading' : 'ready');
    setAlertsError(null);
    setAlertsState(eligible ? 'loading' : 'ready');

    void fetchWeatherForecast(place.lat, place.lon, controller.signal)
      .then(result => {
        if (!active) return;
        setForecast(result);
        setForecastState('ready');
      })
      .catch(error => {
        if (!active || controller.signal.aborted) return;
        setForecastState('error');
        setForecastError(error instanceof Error ? error.message : 'Error desconocido de la fuente.');
      });

    if (eligible) {
      void fetchNwsObservation(place.lat, place.lon, controller.signal)
        .then(result => {
          if (!active) return;
          setObservation(result);
          setObservationState('ready');
        })
        .catch(error => {
          if (!active || controller.signal.aborted) return;
          setObservationState('error');
          setObservationError(error instanceof Error ? error.message : 'La observación no pudo verificarse.');
        });
      void fetchNwsAlerts(place.lat, place.lon, controller.signal)
        .then(result => {
          if (!active) return;
          setAlerts(result);
          setAlertsState('ready');
        })
        .catch(error => {
          if (!active || controller.signal.aborted) return;
          setAlertsState('error');
          setAlertsError(error instanceof Error ? error.message : 'No se pudo consultar NWS.');
        });
    }

    return () => { active = false; controller.abort(); };
  }, [place.lat, place.lon, refreshCycle, eligible]);

  const useDeviceLocation = () => {
    setGpsMessage('');
    if (!navigator.geolocation) {
      setGpsMessage('Este dispositivo no proporciona ubicación. Selecciona una ciudad.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPlace({ label: 'Ubicación del dispositivo', lat: coords.latitude, lon: coords.longitude, origin: 'gps' });
        setGpsMessage('Ubicación compartida para consultar el pronóstico. No se guarda en ATLAS.');
      },
      () => setGpsMessage('No se autorizó la ubicación o no está disponible. Usa una ciudad de la lista.'),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  };

  const current = forecast ? nextWeatherHour(forecast) : null;
  const activeHours = forecast?.hours.filter(hour => Date.parse(hour.at) >= Date.now() - 30 * 60 * 1000).slice(0, 12) || [];
  const activeDays = forecast?.days.filter(day => day.date >= new Date().toISOString().slice(0, 10)).slice(0, 7) || [];
  const kind = current?.kind || 'unknown';

  return (
    <section className="atlas-weather-page">
      <header className="atlas-weather-header">
        <div>
          <p className="eyebrow">ATLAS Weather · Meteorologist Intelligence</p>
          <h1>El tiempo, conectado con tu mundo.</h1>
          <p>Pronósticos mundiales basados en modelos y avisos oficiales donde estén disponibles. Sin inventar observaciones ni alertas.</p>
        </div>
        <div className="atlas-weather-actions">
          <button type="button" onClick={() => setUnit(currentUnit => currentUnit === 'F' ? 'C' : 'F')} aria-label="Cambiar unidad de temperatura">°{unit} ⇄ °{unit === 'F' ? 'C' : 'F'}</button>
          <button type="button" onClick={() => setRefreshCycle(value => value + 1)}>Comprobar actualización</button>
        </div>
      </header>

      <div className="atlas-weather-location-bar">
        <label htmlFor="atlas-weather-city">Lugar del pronóstico</label>
        <select
          id="atlas-weather-city"
          value={place.origin === 'gps' ? 'gps' : place.label}
          onChange={event => {
            const chosen = CITIES.find(city => city.label === event.target.value);
            if (chosen) { setPlace(chosen); setGpsMessage(''); }
          }}
        >
          {CITIES.map(city => <option key={city.label} value={city.label}>{city.label}</option>)}
          {place.origin === 'gps' && <option value="gps">Ubicación del dispositivo</option>}
        </select>
        <button type="button" onClick={useDeviceLocation}>Usar mi ubicación</button>
        <span>{place.origin === 'gps' ? 'GPS autorizado' : 'Ciudad seleccionada · no es tu ubicación GPS'}</span>
      </div>
      {gpsMessage && <p className="atlas-weather-info" role="status">{gpsMessage}</p>}

      <div className={`atlas-weather-hero atlas-weather-hero--${kind}`}>
        <WeatherScene kind={kind} />
        <div className="atlas-weather-hero-content">
          <span className="atlas-weather-kicker">{place.label}</span>
          {forecastState === 'loading' && <p role="status">Consultando el servicio meteorológico…</p>}
          {forecastState === 'error' && <div role="alert"><h2>Datos no disponibles</h2><p>{forecastError}</p><p>No se mostrará un pronóstico simulado.</p></div>}
          {forecastState === 'ready' && forecast && current && (
            <>
              <span className="atlas-weather-provenance">PRONÓSTICO DE MODELO · NO ES UNA LECTURA DE SENSOR</span>
              <div className="atlas-weather-temperature">{formatTemperature(current.celsius, unit)}</div>
              <h2>{describeWeather(kind)}</h2>
              <p>Para {localTime(current.at)} · hora de tu dispositivo</p>
              <div className="atlas-weather-details">
                <div><span>Viento</span><strong>{current.windMps === null ? '—' : `${Math.round(current.windMps * 3.6)} km/h`}</strong></div>
                <div><span>Humedad</span><strong>{current.humidity === null ? '—' : `${Math.round(current.humidity)}%`}</strong></div>
                <div><span>Precipitación prevista</span><strong>{current.precipitationMm === null ? 'Sin dato' : `${current.precipitationMm.toFixed(1)} mm`}</strong></div>
              </div>
            </>
          )}
        </div>
      </div>

      <section className="atlas-weather-section atlas-weather-observation" aria-labelledby="atlas-weather-observed-title">
        <div className="atlas-weather-section-heading">
          <h2 id="atlas-weather-observed-title">Observación real de estación</h2>
          <span>NOAA/NWS · EE. UU. · diferente del pronóstico</span>
        </div>
        {!eligible && <p>No hay estación NOAA/NWS disponible para esta región; los datos de arriba son predicciones del modelo.</p>}
        {eligible && observationState === 'loading' && <p role="status">Buscando una estación de observación oficial…</p>}
        {eligible && observationState === 'error' && <p role="status">No se pudo verificar la observación: {observationError}. No se sustituye con datos inventados.</p>}
        {eligible && observationState === 'ready' && !observation && <p>La estación consultada no proporcionó una lectura reciente utilizable. No se afirma ninguna condición observada.</p>}
        {eligible && observationState === 'ready' && observation && (
          <div className="atlas-weather-measurement">
            <div><span>Temperatura medida</span><strong>{formatTemperature(observation.celsius, unit)}</strong></div>
            <div><span>Estación</span><strong>{observation.station}</strong></div>
            <div><span>Hora de lectura</span><strong>{localTime(observation.observedAt)}</strong></div>
            <div><span>Humedad</span><strong>{observation.humidity === null ? '—' : `${Math.round(observation.humidity)}%`}</strong></div>
            <a href={observation.sourceUrl} target="_blank" rel="noopener noreferrer">Ver lectura NOAA/NWS</a>
          </div>
        )}
      </section>

      {forecastState === 'ready' && forecast && (
        <>
          <section className="atlas-weather-section" aria-labelledby="atlas-weather-hours">
            <div className="atlas-weather-section-heading"><h2 id="atlas-weather-hours">Próximas horas</h2><span>Predicción meteorológica · horario del dispositivo</span></div>
            <div className="atlas-weather-hourly">
              {activeHours.map(hour => (
                <article key={hour.at}>
                  <time dateTime={hour.at}>{new Date(hour.at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</time>
                  <span className="atlas-weather-glyph" title={describeWeather(hour.kind)} aria-label={describeWeather(hour.kind)}>{GLYPHS[hour.kind]}</span>
                  <strong>{formatTemperature(hour.celsius, unit)}</strong>
                  <small>{hour.precipitationMm === null ? '—' : `${hour.precipitationMm.toFixed(1)} mm`}</small>
                </article>
              ))}
            </div>
          </section>
          <section className="atlas-weather-section" aria-labelledby="atlas-weather-days">
            <div className="atlas-weather-section-heading"><h2 id="atlas-weather-days">Perspectiva de 7 días</h2><span>Mínimas y máximas del modelo · agrupación UTC</span></div>
            <div className="atlas-weather-week">
              {activeDays.map(day => (
                <article key={day.date}>
                  <span>{dayLabel(day.date)}</span>
                  <span className="atlas-weather-glyph" aria-label={describeWeather(day.kind)}>{GLYPHS[day.kind]}</span>
                  <strong>{formatTemperature(day.maximumC, unit)}</strong>
                  <small>{formatTemperature(day.minimumC, unit)}</small>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="atlas-weather-section atlas-weather-alerts" aria-labelledby="atlas-weather-alert-title">
        <div className="atlas-weather-section-heading">
          <h2 id="atlas-weather-alert-title">Alertas meteorológicas oficiales</h2>
          <span>National Weather Service · EE. UU.</span>
        </div>
        {!eligible && <p>Las alertas NWS cubren zonas de EE. UU. Esta ubicación necesita otro organismo oficial de alertas, aún no conectado.</p>}
        {eligible && alertsState === 'loading' && <p role="status">Consultando avisos oficiales…</p>}
        {eligible && alertsState === 'error' && <p role="alert">Alertas no verificadas: {alertsError}. Consulta directamente el servicio oficial.</p>}
        {eligible && alertsState === 'ready' && alerts.length === 0 && <p>La consulta oficial no devolvió alertas activas para este punto. La situación puede cambiar.</p>}
        {eligible && alertsState === 'ready' && alerts.map(alert => (
          <article className="atlas-weather-alert" key={alert.id}>
            <span>{alert.severity} · NWS</span>
            <h3>{alert.title}</h3>
            {alert.expiresAt && <p>Vigencia indicada hasta {localTime(alert.expiresAt)}</p>}
            {alert.description && <p>{alert.description}</p>}
            {alert.instruction && <p><strong>Instrucciones: </strong>{alert.instruction}</p>}
            <a href={alert.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir aviso original</a>
          </article>
        ))}
        <p className="atlas-weather-disclaimer">ATLAS no sustituye los avisos de emergencia. Ante peligro, sigue las indicaciones de las autoridades locales.</p>
      </section>

      <footer className="atlas-weather-footer">
        <div>
          <strong>Procedencia y actualización</strong>
          {forecast ? <p>Modelo actualizado {localTime(forecast.modelUpdatedAt)} · recibido {localTime(forecast.fetchedAt)} · próxima consulta al proveedor según caché hasta {localTime(forecast.expiresAt)}.</p> : <p>No hay predicciones verificadas para esta consulta.</p>}
          <p>Datos y modelos: <a href="https://api.met.no/" target="_blank" rel="noopener noreferrer">Norwegian Meteorological Institute (MET Norway)</a>, licencia <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Alertas: <a href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">NOAA/NWS</a>.</p>
          <p>El modo «en vivo» actualiza datos publicados por las fuentes; no implica sensores continuos ni radar en tiempo real.</p>
        </div>
        <nav aria-label="Integraciones meteorológicas de ATLAS">
          <Link to="/gps">GPS 4D</Link>
          <Link to="/city">Digital City</Link>
        </nav>
      </footer>
    </section>
  );
}

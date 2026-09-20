import { Link } from 'react-router-dom';
import './voice.css';

const capabilities = [
  ['Autorización de Personal Voice', 'Requiere app ATLAS para iOS'],
  ['Reproducción local', 'Solo cliente nativo compatible'],
  ['Exportación del modelo de voz', 'No disponible'],
  ['Captura del audio generado por Apple', 'No disponible'],
  ['Síntesis en servidor', 'No disponible']
] as const;

export function AppleVoicePage() {
  return (
    <section className="page-stack voice-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Voice · Apple Bridge</p>
        <h1>Apple Personal Voice</h1>
        <p>
          Apple Personal Voice permanece en el dispositivo. ATLAS web no la exporta, no captura su audio
          generado y no presenta el bridge como verificado hasta una prueba real en un dispositivo compatible.
        </p>
      </header>

      <div className="voice-native-gate" role="status">
        <span className="voice-native-icon" aria-hidden="true">A</span>
        <div>
          <strong>Bridge nativo pendiente de verificación física</strong>
          <p>La autorización debe solicitarse desde el cliente ATLAS para iOS; esta página solo refleja el límite real de la plataforma.</p>
        </div>
      </div>

      <section className="voice-section" aria-labelledby="apple-capabilities-heading">
        <h2 id="apple-capabilities-heading">Estado de capacidades</h2>
        <div className="voice-capability-list">
          {capabilities.map(([label, status]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{status}</strong>
            </div>
          ))}
        </div>
      </section>

      <Link className="text-link" to="/voice/personal-voice">Volver a Personal Voice</Link>
    </section>
  );
}

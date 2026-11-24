import { useState } from 'react';

const setup = {
  windows: { label: 'Windows 11', install: 'winget install --exact Genymobile.scrcpy' },
  macos: { label: 'macOS', install: 'brew install scrcpy android-platform-tools' },
  linux: { label: 'Ubuntu / Linux', install: 'sudo apt install adb scrcpy' }
} as const;

type Platform = keyof typeof setup;
const command = 'node tools/local-agent/atlas-phone-bridge.mjs';

/** Shows truthful launch instructions; browser cannot access native USB directly. */
export function PhoneBridgePanel() {
  const [platform,setPlatform] = useState<Platform>('windows');
  const [message,setMessage] = useState('');

  async function copy(value:string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage('Comando copiado. Ejecútalo en la terminal de tu computadora.');
    } catch {
      setMessage('No fue posible copiar. Selecciona el comando manualmente.');
    }
  }

  return (
    <article className="feature-card wide" aria-labelledby="phone-bridge-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ATLAS Device OS · Local Core</p>
          <h2 id="phone-bridge-title">Phone Bridge — Tu teléfono en la computadora</h2>
        </div>
        <span className="status-chip warning">Conexión física sin verificar</span>
      </div>
      <p>
        Duplica y controla la pantalla de un Android autorizado desde Windows, macOS o Linux
        con teclado y mouse. Envía archivos sin subirlos a la nube. Usa USB o una sesión
        ADB inalámbrica emparejada previamente, sin introducir un segundo control plane.
      </p>
      <div className="filter-row" aria-label="Sistema operativo">
        {(Object.keys(setup) as Platform[]).map((id) => (
          <button type="button" key={id} aria-pressed={platform===id}
            className={platform===id?'enabled':''}
            onClick={()=>{setPlatform(id);setMessage('')}}>{setup[id].label}</button>
        ))}
      </div>
      <div className="module-grid compact">
        <div className="module-card">
          <span>1 · Instalar herramientas</span><strong>ADB + scrcpy</strong>
          <code style={{overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{setup[platform].install}</code>
          <button type="button" onClick={()=>void copy(setup[platform].install)}>Copiar comando</button>
        </div>
        <div className="module-card">
          <span>2 · Iniciar desde ATLAS</span><strong>Puente local</strong>
          <code style={{overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{command}</code>
          <button type="button" onClick={()=>void copy(command)}>Copiar inicio</button>
        </div>
        <div className="module-card">
          <span>3 · Conectar y autorizar</span><strong>Dispositivo Android</strong>
          <p>Activa Depuración USB en tu teléfono, conecta un cable de datos y aprueba
          su huella RSA. Visita http://127.0.0.1:8765 en esa misma computadora.</p>
        </div>
      </div>
      {message ? <p role="status" className="notice">{message}</p> : null}
      <div className="notice">
        Ningún teléfono se considera conectado por mostrar este panel.
        La duplicación requiere ADB y scrcpy instalados y autorización física del dueño.
        En Mac, iPhone Mirroring es una alternativa nativa para iPhone compatible;
        Windows no ofrece el mismo control general de iPhone. Las sesiones remotas
        deberán utilizar el Local Control Plane con permisos y auditoría explícitos.
      </div>
      <p>
        <a href="https://github.com/atlasenterprisesuite/atlasenterprisesuite/blob/main/docs/architecture/ATLAS_PHONE_BRIDGE.md"
          target="_blank" rel="noopener noreferrer">Guía de instalación y seguridad</a>
        {' · '}
        <a href="https://github.com/Genymobile/scrcpy" target="_blank"
          rel="noopener noreferrer">Proyecto scrcpy oficial</a>
      </p>
    </article>
  );
}

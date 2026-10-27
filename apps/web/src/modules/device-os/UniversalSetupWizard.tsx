import { useEffect, useState } from 'react';
import { getSetupSteps } from './universalSetupModel';
import { DEFAULT_SETUP_DRAFT, parseSetupDraft, serializeSetupDraft, type SetupDraft } from './universalSetupDraft';
import { loadAccessibilityProfile, resolveAccessibilityUserId, saveAccessibilityProfile } from '../../services/accessibilityProfile';

const STORAGE_PREFIX = 'atlas:universal-setup:draft:v1:';
function draftKey() {
  const userId = resolveAccessibilityUserId();
  return userId === 'local-user' ? null : STORAGE_PREFIX + userId;
}
function initialDraft(): SetupDraft {
  try {
    const key = draftKey();
    return key ? parseSetupDraft(window.sessionStorage.getItem(key)) ?? DEFAULT_SETUP_DRAFT : DEFAULT_SETUP_DRAFT;
  } catch { return DEFAULT_SETUP_DRAFT; }
}
export function UniversalSetupWizard() {
  const [draft, setDraft] = useState<SetupDraft>(initialDraft);
  const [message, setMessage] = useState('');
  const steps = getSetupSteps(draft.language);
  const current = steps[draft.step];
  useEffect(() => {
    try {
      const key = draftKey();
      if (key) window.sessionStorage.setItem(key, serializeSetupDraft(draft));
    } catch { /* Storage may be disabled: wizard remains usable without persistence. */ }
  }, [draft]);
  const update = (patch: Partial<SetupDraft>) => setDraft(prev => ({ ...prev, ...patch }));
  const spanish = draft.language === 'es';
  return (
    <section className="feature-card wide" aria-labelledby="atlas-universal-setup-title">
      <p className="eyebrow">ATLAS Universal Setup 777 · Guided preview</p>
      <h2 id="atlas-universal-setup-title">{current.title}</h2>
      <p aria-live="polite">{spanish ? 'Paso' : 'Step'} {draft.step + 1} / {steps.length}</p>
      <progress value={draft.step + 1} max={steps.length} aria-label={spanish ? 'Progreso de configuración' : 'Setup progress'} />
      {current.id === 'language' && (
        <label>{spanish ? 'Idioma' : 'Language'}
          <select value={draft.language} onChange={event => update({ language: event.target.value === 'es' ? 'es' : 'en' })}>
            <option value="en">English</option><option value="es">Español</option>
          </select>
        </label>
      )}
      {current.id === 'accessibility' && (
        <label><input type="checkbox" checked={draft.captions} onChange={event => update({ captions: event.target.checked })} />
          {spanish ? 'Activar subtítulos' : 'Enable captions'}
        </label>
      )}
      {current.id === 'identity' && <p>{spanish ? 'Acceso protegido por ATLAS Identity. Este asistente no verifica ni almacena credenciales.' : 'Access is protected by ATLAS Identity. This wizard does not verify or store credentials.'}</p>}
      {current.id === 'device' && <p>{spanish ? 'La vinculación real requiere un servicio autorizado del dispositivo.' : 'Real device pairing requires an authorized device service.'}</p>}
      {current.id === 'migration' && <div className="notice" role="status">{spanish ? 'Migración bloqueada: faltan autorización del servidor, consentimiento verificable y adaptador aprobado.' : 'Migration blocked: server authorization, verifiable consent and approved adapter are required.'}</div>}
      {current.id === 'security' && <p>{spanish ? 'La protección depende de los controles de identidad, permisos y servidor existentes.' : 'Protection depends on existing identity, permission and server controls.'}</p>}
      {current.id === 'assistant' && <p>{spanish ? 'ATLAS AI requiere un proveedor y permisos activos. No se ha iniciado una conversación.' : 'ATLAS AI requires an active provider and permissions. No conversation has started.'}</p>}
      {current.id === 'welcome' && <p>{spanish ? 'Configura tu experiencia sin transferir datos automáticamente.' : 'Configure your experience without automatically transferring data.'}</p>}
      <div className="module-grid compact">
        <button type="button" disabled={draft.step === 0} onClick={() => { update({ step: draft.step - 1 }); setMessage(''); }}>{spanish ? 'Atrás' : 'Back'}</button>
        {draft.step < steps.length - 1 && <button type="button" onClick={() => { update({ step: draft.step + 1 }); setMessage(''); }}>{spanish ? 'Siguiente' : 'Next'}</button>}
        {current.id === 'accessibility' && <button type="button" onClick={() => {
          const userId = resolveAccessibilityUserId();
          if (userId === 'local-user') { setMessage(spanish ? 'Inicia sesión para guardar preferencias.' : 'Sign in to save preferences.'); return; }
          try {
            const profile = loadAccessibilityProfile(userId);
            saveAccessibilityProfile({ ...profile, captionsEnabled: draft.captions });
            setMessage(spanish ? 'Preferencia guardada localmente; sincronización remota no confirmada.' : 'Preference saved locally; remote sync not confirmed.');
          } catch { setMessage(spanish ? 'No se pudo guardar la preferencia.' : 'Could not save preference.'); }
        }}>{spanish ? 'Guardar accesibilidad' : 'Save accessibility'}</button>}
      </div>
      <p role="status" aria-live="polite">{message}</p>
      <p className="notice">{spanish ? 'Vista guiada: no vincula dispositivos ni migra información.' : 'Guided preview: does not pair devices or migrate information.'}</p>
    </section>
  );
}

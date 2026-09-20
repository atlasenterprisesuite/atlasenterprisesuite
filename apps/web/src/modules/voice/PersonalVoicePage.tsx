import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AtlasVoiceApi, atlasVoiceApi, type VoiceProfileRow } from './voiceApi';
import './voice.css';

type PersonalVoicePageProps = {
  api?: Pick<AtlasVoiceApi, 'listProfiles'>;
};

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  sound_check: 'Prueba de sonido',
  recording: 'Grabando',
  reviewing: 'Revisión',
  ready_to_generate: 'Grabación completa',
  generating: 'Generando',
  ready: 'Lista',
  suspended: 'Suspendida',
  deleted: 'Eliminada'
};

function continuationRoute(profile: VoiceProfileRow) {
  if (profile.status === 'sound_check') return '/voice/personal-voice/sound-check';
  if (profile.status === 'recording') return '/voice/personal-voice/record';
  if (profile.status === 'reviewing' || profile.status === 'ready_to_generate') return '/voice/personal-voice/review';
  return '/voice/personal-voice/setup';
}

export function PersonalVoicePage({ api = atlasVoiceApi }: PersonalVoicePageProps) {
  const [profiles, setProfiles] = useState<VoiceProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void api.listProfiles()
      .then((rows) => {
        if (!active) return;
        setProfiles(rows.filter((profile) => profile.status !== 'deleted'));
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError('ATLAS no pudo cargar tus perfiles de voz.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [api]);

  const activeProfiles = useMemo(() => profiles.filter((profile) => profile.provider_kind === 'atlas'), [profiles]);

  return (
    <section className="page-stack voice-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Voice</p>
        <h1>Personal Voice</h1>
        <p>
          Crea una voz personal gobernada por consentimiento, validación acústica, almacenamiento privado y
          aislamiento por organización. La generación final permanece bloqueada hasta que exista un proveedor verificado.
        </p>
      </header>

      <div className="voice-hero-grid">
        <Link className="voice-card voice-card-primary" to="/voice/personal-voice/setup">
          <span className="voice-card-kicker">ATLAS Personal Voice</span>
          <strong>Crear mi voz ATLAS</strong>
          <p>Preparación, prueba acústica, diez frases guiadas, revisión y persistencia segura en Supabase.</p>
          <span className="action-link">Comenzar</span>
        </Link>
        <Link className="voice-card" to="/voice/personal-voice/apple">
          <span className="voice-card-kicker">Apple bridge</span>
          <strong>Apple Personal Voice</strong>
          <p>Consulta el límite nativo y el estado de autorización sin exportar la voz del dispositivo.</p>
          <span className="action-link">Ver disponibilidad</span>
        </Link>
      </div>

      <section className="voice-section" aria-labelledby="my-voices-heading">
        <div className="voice-section-heading">
          <div>
            <p className="eyebrow">Biblioteca privada</p>
            <h2 id="my-voices-heading">Mis voces</h2>
          </div>
          <span className="voice-provider-chip">Generación: no configurada</span>
        </div>

        {loading ? <div className="empty-state"><strong>Cargando perfiles…</strong></div> : null}
        {error ? <div className="voice-alert" role="alert">{error}</div> : null}
        {!loading && !error && activeProfiles.length === 0 ? (
          <div className="empty-state">
            <strong>Aún no has creado una voz ATLAS</strong>
            <span>La primera grabación se guardará solo después de pasar los controles de calidad y consentimiento.</span>
          </div>
        ) : null}

        {activeProfiles.length > 0 ? (
          <div className="voice-profile-list">
            {activeProfiles.map((profile) => (
              <article className="voice-profile-row" key={profile.id}>
                <div>
                  <span className="voice-card-kicker">{profile.language}</span>
                  <strong>{profile.name}</strong>
                  <small>{statusLabels[profile.status] || profile.status}</small>
                </div>
                {profile.status === 'ready' ? (
                  <span className="voice-state">Lista</span>
                ) : (
                  <Link className="secondary-action" to={continuationRoute(profile)}>Continuar</Link>
                )}
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <div className="notice strong">
        ATLAS Voice está preparado para captura y persistencia gobernada. Ningún proveedor externo de clonación o
        síntesis se presenta como conectado hasta superar verificación real.
      </div>
    </section>
  );
}

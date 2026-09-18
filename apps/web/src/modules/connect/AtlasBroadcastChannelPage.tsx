import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './atlas-broadcast-channel.css';

type Reaction = 'heart' | 'celebrate' | 'insightful';

type BroadcastMessage = {
  id: string;
  language: 'EN' | 'ES';
  title: string;
  body: string;
  pinned?: boolean;
};

const CHANNEL = {
  name: 'ATLAS Network',
  brand: 'ATLAS Enterprise Suite',
  tagline: 'One Platform. Every Solution. Total Control.',
  description: 'Official product updates, security notices, launches, operational announcements and ecosystem news from ATLAS.',
  languages: 'English · Español'
} as const;

const MESSAGES: readonly BroadcastMessage[] = [
  {
    id: 'atlas-network-welcome-en',
    language: 'EN',
    title: 'Welcome to ATLAS Network',
    body: 'This is the official broadcast channel for ATLAS Enterprise Suite. Follow product releases, module launches, security notices, platform status and major ecosystem updates in one governed feed.',
    pinned: true
  },
  {
    id: 'atlas-network-welcome-es',
    language: 'ES',
    title: 'Bienvenido a ATLAS Network',
    body: 'Este es el canal oficial de difusión de ATLAS Enterprise Suite. Aquí se publican lanzamientos, nuevos módulos, avisos de seguridad, estado de la plataforma y actualizaciones importantes del ecosistema.',
    pinned: true
  }
];

export function AtlasBroadcastChannelPage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [language, setLanguage] = useState<'all' | BroadcastMessage['language']>('all');
  const [reactions, setReactions] = useState<Record<string, Reaction | undefined>>({});

  const visibleMessages = useMemo(
    () => MESSAGES.filter((message) => language === 'all' || message.language === language),
    [language]
  );

  function toggleReaction(messageId: string, reaction: Reaction) {
    setReactions((current) => ({
      ...current,
      [messageId]: current[messageId] === reaction ? undefined : reaction
    }));
  }

  return (
    <section className="page-stack broadcast-page" aria-labelledby="atlas-network-title">
      <header className="broadcast-hero">
        <div className="broadcast-avatar" aria-hidden="true">A</div>
        <div className="broadcast-identity">
          <div className="broadcast-name-row">
            <h1 id="atlas-network-title">{CHANNEL.name}</h1>
            <span className="official-badge" title="Official ATLAS channel">Official</span>
          </div>
          <p>{CHANNEL.brand} · {CHANNEL.languages}</p>
          <strong>{CHANNEL.tagline}</strong>
        </div>
        <button
          type="button"
          className={notificationsEnabled ? 'notification-button active' : 'notification-button'}
          aria-pressed={notificationsEnabled}
          onClick={() => setNotificationsEnabled((value) => !value)}
        >
          {notificationsEnabled ? 'Notifications on' : 'Notifications off'}
        </button>
      </header>

      <div className="broadcast-status-grid">
        <article className="broadcast-status-card">
          <span>Channel status</span>
          <strong>Configured in ATLAS</strong>
          <p>The canonical ATLAS channel identity and bilingual welcome feed are available.</p>
        </article>
        <article className="broadcast-status-card">
          <span>External distribution</span>
          <strong>Authorization required</strong>
          <p>ATLAS does not claim a social provider connection until the organization authorizes and verifies it.</p>
        </article>
        <article className="broadcast-status-card">
          <span>Audience</span>
          <strong>Provider-sourced only</strong>
          <p>No follower or member totals are fabricated while external audience synchronization is unavailable.</p>
        </article>
      </div>

      <div className="broadcast-layout">
        <div className="broadcast-feed-column">
          <div className="broadcast-toolbar" aria-label="Broadcast controls">
            <div>
              <p className="eyebrow">Official feed</p>
              <h2>Announcements</h2>
            </div>
            <label className="field broadcast-filter">
              <span>Language</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}>
                <option value="all">English + Español</option>
                <option value="EN">English</option>
                <option value="ES">Español</option>
              </select>
            </label>
          </div>

          <div className="broadcast-feed">
            {visibleMessages.map((message) => (
              <article key={message.id} className="broadcast-message">
                <div className="broadcast-message-meta">
                  <span className="broadcast-language">{message.language}</span>
                  {message.pinned ? <span className="broadcast-pinned">Pinned</span> : null}
                </div>
                <h3>{message.title}</h3>
                <p>{message.body}</p>
                <div className="broadcast-reactions" aria-label={`Reactions to ${message.title}`}>
                  <button
                    type="button"
                    className={reactions[message.id] === 'heart' ? 'selected' : ''}
                    aria-pressed={reactions[message.id] === 'heart'}
                    onClick={() => toggleReaction(message.id, 'heart')}
                  >
                    ♥
                  </button>
                  <button
                    type="button"
                    className={reactions[message.id] === 'celebrate' ? 'selected' : ''}
                    aria-pressed={reactions[message.id] === 'celebrate'}
                    onClick={() => toggleReaction(message.id, 'celebrate')}
                  >
                    ✦
                  </button>
                  <button
                    type="button"
                    className={reactions[message.id] === 'insightful' ? 'selected' : ''}
                    aria-pressed={reactions[message.id] === 'insightful'}
                    onClick={() => toggleReaction(message.id, 'insightful')}
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="broadcast-admin-card">
          <p className="eyebrow">ATLAS Connect</p>
          <h2>Channel configuration</h2>
          <dl>
            <div><dt>Name</dt><dd>{CHANNEL.name}</dd></div>
            <div><dt>Brand</dt><dd>{CHANNEL.brand}</dd></div>
            <div><dt>Visibility</dt><dd>Official broadcast</dd></div>
            <div><dt>Languages</dt><dd>{CHANNEL.languages}</dd></div>
            <div><dt>Publishing</dt><dd>Governed handoff</dd></div>
          </dl>
          <p className="broadcast-description">{CHANNEL.description}</p>
          <div className="broadcast-admin-actions">
            <Link className="primary-button broadcast-link-button" to="/business/growth/social-publisher">
              Open Social Publisher
            </Link>
            <Link className="secondary-button broadcast-link-button" to="/connect">
              Back to Connect
            </Link>
          </div>
          <div className="connection-gate">
            <strong>External provider gate active</strong>
            <span>Publishing to an external broadcast channel remains disabled until a supported provider connection is authorized and verified.</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

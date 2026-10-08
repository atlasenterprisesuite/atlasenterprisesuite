import { useState } from 'react';

type Platform = 'windows' | 'ubuntu';
const installation: Record<Platform, { install: string; doctor: string; memory: string; label: string }> = {
  windows: {
    label: 'Windows 11 / PowerShell',
    install: '.\\tools\\local-agent\\install-local-core-windows.ps1',
    doctor: '& "$env:LOCALAPPDATA\\ATLAS\\LocalCore\\atlas-local-core.cmd" doctor',
    memory: '& "$env:LOCALAPPDATA\\ATLAS\\LocalCore\\atlas-local-core.cmd" memory put first-note'
  },
  ubuntu: {
    label: 'Ubuntu 24.04 / Terminal',
    install: 'bash ./tools/local-agent/install-local-core-ubuntu.sh',
    doctor: '"${XDG_DATA_HOME:-$HOME/.local/share}/atlas/local-core/atlas-local-core" doctor',
    memory: '"${XDG_DATA_HOME:-$HOME/.local/share}/atlas/local-core/atlas-local-core" memory put first-note'
  }
};

export function LocalCorePanel() {
  const [platform, setPlatform] = useState<Platform>('windows');
  const [message, setMessage] = useState('');
  const steps = installation[platform];

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Command copied. Execute it locally after reviewing the repository source.');
    } catch {
      setMessage('Clipboard unavailable. Select and copy the command manually.');
    }
  }

  return (
    <article className="feature-card wide" aria-labelledby="device-local-core-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ATLAS Device OS · Local Core</p>
          <h2 id="device-local-core-title">Private AI on your own computer</h2>
        </div>
        <span className="status-chip warning">Device not verified</span>
      </div>
      <p>
        Install the portable runtime for local inference and AES-256-GCM encrypted memory.
        Nothing is silently uploaded, and no cloud fallback or background service is enabled.
      </p>
      <div className="notice">
        No Windows or Ubuntu device connection has been established by this screen.
        Package signing, real-model inference and device enrollment require independent verification.
        The Local Control Plane below handles separately authorized remote agents.
      </div>
      <div className="filter-row" aria-label="Select local core platform">
        {(['windows', 'ubuntu'] as const).map((id) => (
          <button key={id} type="button" className={platform === id ? 'enabled' : ''}
            aria-pressed={platform === id} onClick={() => { setPlatform(id); setMessage(''); }}>
            {installation[id].label}
          </button>
        ))}
      </div>
      <p>
        Requirements: Node.js 22+, an existing checkout of the official ATLAS repository,
        and an optionally installed compatible llama.cpp binary/GGUF model for actual inference.
      </p>
      <div className="module-grid compact">
        {([
          ['1 · Install locally', steps.install],
          ['2 · Check readiness', steps.doctor],
          ['3 · Create encrypted memory', steps.memory]
        ] as const).map(([label, command]) => (
          <div className="module-card" key={label}>
            <strong>{label}</strong>
            <code style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{command}</code>
            <button type="button" onClick={() => void copy(command)}>Copy command</button>
          </div>
        ))}
      </div>
      {message ? <p role="status" className="notice">{message}</p> : null}
      <p>
        <a href="https://github.com/atlasenterprisesuite/atlasenterprisesuite/tree/main/tools/local-agent"
          target="_blank" rel="noopener noreferrer">Review installer source on GitHub</a>
        {' · '}
        <a href="https://github.com/atlasenterprisesuite/atlasenterprisesuite/blob/main/docs/architecture/ATLAS_LOCAL_CORE_WAVE2.md"
          target="_blank" rel="noopener noreferrer">Security and setup guide</a>
      </p>
    </article>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AUTOMOTIVE_CLAIMS, AUTOMOTIVE_MODELS, resolveAutomotiveClaim,
  type AutomotiveClaimKey
} from './automotive-evidence';
import { validateAutomotiveImageSignature } from './automotive-image';
import './automotive.css';

const FACTS: readonly { key: AutomotiveClaimKey; label: string; unit: string }[] = [
  { key: 'power_bhp', label: 'Max power', unit: 'bhp' },
  { key: 'torque_nm', label: 'Max torque', unit: 'Nm' },
  { key: 'zero_to_100_seconds', label: '0–100 km/h', unit: 's' },
  { key: 'top_speed_kmh', label: 'Top speed', unit: 'km/h' }
];

export function AutomotiveIntelligencePage() {
  const [selectedId, setSelectedId] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState('');
  const [error, setError] = useState('');
  const readGeneration = useRef(0);
  const model = AUTOMOTIVE_MODELS.find((item) => item.id === selectedId);

  // Object URL is the only location of the selected image. Never upload or persist it.
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  // Cancel any unfinished read when the workspace unmounts.
  useEffect(() => () => { readGeneration.current += 1; }, []);

  function clearLocalPhoto() {
    readGeneration.current += 1;
    setPhotoUrl(null);
    setPhotoName('');
  }

  async function inspectLocalPhoto(file: File | undefined) {
    if (!file) return;
    const generation = ++readGeneration.current;
    setError('');
    try {
      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      // A newer file selection, clear action or unmount invalidates this read.
      if (generation !== readGeneration.current) return;
      const problem = validateAutomotiveImageSignature(file.type, header, file.size);
      if (problem) {
        clearLocalPhoto();
        setError(problem);
        return;
      }
      setPhotoUrl(URL.createObjectURL(file));
      setPhotoName(file.name);
    } catch {
      if (generation !== readGeneration.current) return;
      clearLocalPhoto();
      setError('The image could not be read locally.');
    }
  }

  return (
    <main className="page-stack automotive-intelligence-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Mobility · 777 REVIEW</p>
        <h1>Automotive Intelligence</h1>
        <p>Local image intake and source-backed manufacturer specifications. This workspace does not claim automatic image identification, VIN validation, live inventory or pricing.</p>
      </header>
      <div className="notice" role="note">
        Evidence-first pilot · No vision provider, dealership feed or production storage is connected. Images remain in this browser tab.
      </div>
      <div className="automotive-workflow">
        <section className="workspace-card">
          <h2>1 · Inspect a local photograph</h2>
          <label className="field" htmlFor="automotive-image">
            <span>Select JPEG, PNG or WebP (8 MB maximum)</span>
          </label>
          <input
            id="automotive-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              void inspectLocalPhoto(file);
              event.currentTarget.value = '';
            }}
          />
          {error && <p role="alert">{error}</p>}
          {photoUrl ? (
            <figure className="automotive-preview">
              <img src={photoUrl} alt="Locally selected vehicle photograph, not automatically identified" />
              <figcaption>{photoName} · Local preview only</figcaption>
            </figure>
          ) : <p className="automotive-empty">No local image selected.</p>}
          {photoUrl && <button type="button" onClick={clearLocalPhoto}>Clear image</button>}
          <p><strong>Visual recognition:</strong> Not configured. A photo alone cannot certify the vehicle identity or VIN.</p>
        </section>

        <section className="workspace-card">
          <h2>2 · Select a model hypothesis</h2>
          <p>Choose a model manually. This is a research hypothesis, not a machine-learning result.</p>
          <label className="field" htmlFor="automotive-model">
            <span>Reference model</span>
          </label>
          <select
            id="automotive-model"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            <option value="">No model identified</option>
            {AUTOMOTIVE_MODELS.map((item) => <option key={item.id} value={item.id}>{item.manufacturer} {item.name}</option>)}
          </select>
          <div aria-live="polite" className="automotive-manual-state">
            {model ? <p><strong>Manually selected:</strong> {model.manufacturer} {model.name}. No automated confidence score exists.</p> :
              <p><strong>Identity:</strong> Unverified. Select a reference model to view specifications.</p>}
          </div>
          {model && <p>{model.description}</p>}
        </section>
      </div>

      <section className="workspace-card">
        <h2>3 · Manufacturer specifications and provenance</h2>
        {!model ? <p className="automotive-empty">No specifications are attributed to an unidentified image.</p> : (
          <>
            <div className="table-wrap">
              <table>
                <caption>Model-level claims only; not specifications certified for a particular VIN.</caption>
                <thead><tr><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Evidence</th></tr></thead>
                <tbody>
                  {FACTS.map((fact) => {
                    const resolution = resolveAutomotiveClaim(AUTOMOTIVE_CLAIMS, model.id, fact.key);
                    return (
                      <tr key={fact.key}>
                        <th scope="row">{fact.label}</th>
                        <td>{resolution.values.length ? resolution.values.join(' / ') + ' ' + fact.unit : 'Not verified'}</td>
                        <td>
                          <strong>{resolution.status === 'conflict' ? 'Source conflict' : resolution.status === 'verified' ? 'Manufacturer source' : 'Unverified'}</strong>
                          {resolution.sources.map((source, index) => (
                            <span className="automotive-source" key={source.url + source.section + index}>
                              <a href={source.url} rel="noopener noreferrer" target="_blank">
                                {source.publisher} · {source.section}
                              </a> · checked {source.checkedAt}
                            </span>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p role="note">A conflict is displayed rather than automatically selecting a marketing or technical specification.</p>
          </>
        )}
      </section>

      <section className="workspace-card">
        <h2>4 · Connected ATLAS capabilities</h2>
        <p><strong>Market pricing:</strong> Not verified for a specific model year, condition or date. No dealership inventory or price feed is connected.</p>
        <p><strong>VIN and ownership:</strong> Not collected. Vehicle identification requires separate authoritative evidence.</p>
        <p><strong>Financial reporting:</strong> The existing <Link to="/finance/accounting/reports/automotive-sales">Automotive Sales Financial Reporting</Link> remains a separate, demo-data-only accounting capability.</p>
        <p><strong>Storage and audit:</strong> No photo or user record is sent to a backend. A tenant-scoped persistence adapter, authorization and audit trail must be validated before any server-side storage or third-party image recognition.</p>
      </section>
    </main>
  );
}

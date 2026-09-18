import { useMemo, useState } from 'react';
import {
  ATLAS_DEVICE_PROFILES,
  getAtlasDeviceProfile,
  summarizeDeviceReadiness,
  type AtlasDeviceId
} from './deviceOSModel';

export function DeviceOSPage() {
  const [selectedId, setSelectedId] = useState<AtlasDeviceId>('phone');
  const selected = useMemo(() => getAtlasDeviceProfile(selectedId), [selectedId]);
  const readiness = summarizeDeviceReadiness(selected);

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Device OS</p>
        <h1>One Core. Every Device.</h1>
        <p>
          A governed device layer for mobile, desktop, wearables, smart spaces and mobility.
          Software capabilities are live in ATLAS; physical hardware functions remain explicitly
          gated until an authorized adapter is connected.
        </p>
      </header>

      <div className="notice strong">
        Production truth: this module exposes the ATLAS software control plane. Hardware radios,
        sensors, secure elements and vehicle interfaces are never reported as connected unless a
        real adapter is available.
      </div>

      <div className="module-grid compact" aria-label="ATLAS device profiles">
        {ATLAS_DEVICE_PROFILES.map((device) => (
          <button
            key={device.id}
            type="button"
            className={device.id === selectedId ? 'module-card enabled' : 'module-card'}
            onClick={() => setSelectedId(device.id)}
            aria-pressed={device.id === selectedId}
          >
            <span>{device.category}</span>
            <strong>{device.name}</strong>
            <p>{device.description}</p>
          </button>
        ))}
      </div>

      <article className="feature-card wide">
        <div className="card-heading">
          <div>
            <p className="eyebrow">{selected.category}</p>
            <h2>{selected.name}</h2>
          </div>
          <span className="status-chip neutral">
            {readiness.softwareReady}/{readiness.total} software-ready
          </span>
        </div>
        <p>{selected.description}</p>
        <div className="module-grid compact">
          {selected.capabilities.map((capability) => (
            <div className="module-card" key={capability.id}>
              <span>{capability.status === 'software-ready' ? 'ATLAS Core' : 'Hardware boundary'}</span>
              <strong>{capability.label}</strong>
              <p>
                {capability.status === 'software-ready'
                  ? 'Available through the shared governed ATLAS software layer.'
                  : 'Requires a signed, authorized physical-device adapter before live execution.'}
              </p>
              <span className={capability.status === 'software-ready' ? 'status-chip' : 'status-chip warning'}>
                {capability.status === 'software-ready' ? 'Ready' : 'Adapter required'}
              </span>
            </div>
          ))}
        </div>
      </article>

      <div className="stat-grid" aria-label="Selected device readiness">
        <article><strong>{readiness.softwareReady}</strong><span>software capabilities ready</span></article>
        <article><strong>{readiness.adapterRequired}</strong><span>hardware adapters required</span></article>
        <article><strong>{ATLAS_DEVICE_PROFILES.length}</strong><span>device profiles</span></article>
        <article><strong>Zero Trust</strong><span>permission boundary</span></article>
      </div>
    </section>
  );
}

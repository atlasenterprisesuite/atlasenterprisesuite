import { useMemo, useState } from 'react';
import { LocalNetworkAccessPanel } from './LocalNetworkAccessPanel';
import { LocalControlPlanePanel } from './LocalControlPlanePanel';
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
          Canonical ATLAS software contracts and physical runtime evidence are reported separately,
          so code presence is never presented as proof that a device or adapter is connected.
        </p>
      </header>

      <div className="notice strong">
        Production truth: “implemented core” means the capability exists in the canonical ATLAS
        codebase. It does not mean a device is online. Hardware radios, sensors, secure elements,
        native OS bridges and vehicle interfaces remain unverified until real runtime evidence exists.
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
            {readiness.implementedCore}/{readiness.total} core implemented
          </span>
        </div>
        <p>{selected.description}</p>
        <div className="module-grid compact">
          {selected.capabilities.map((capability) => (
            <div className="module-card" key={capability.id}>
              <span>{capability.status === 'implemented-core' ? 'Canonical ATLAS core' : 'External hardware boundary'}</span>
              <strong>{capability.label}</strong>
              <p>
                {capability.status === 'implemented-core'
                  ? 'Implemented in the shared governed ATLAS codebase; runtime connectivity is evaluated separately.'
                  : 'Requires a signed, authorized physical-device adapter before live execution.'}
              </p>
              <span className={capability.status === 'implemented-core' ? 'status-chip' : 'status-chip warning'}>
                {capability.status === 'implemented-core' ? 'Ready' : 'Adapter required'}
              </span>
            </div>
          ))}
        </div>
      </article>

      <div className="stat-grid" aria-label="Selected device readiness">
        <article><strong>{readiness.implementedCore}</strong><span>canonical core capabilities implemented</span></article>
        <article><strong>{readiness.adapterRequired}</strong><span>hardware adapters required</span></article>
        <article><strong>{ATLAS_DEVICE_PROFILES.length}</strong><span>device profiles</span></article>
        <article><strong>Zero Trust</strong><span>permission boundary</span></article>
      </div>

      <LocalNetworkAccessPanel />
      <LocalControlPlanePanel />
    </section>
  );
}

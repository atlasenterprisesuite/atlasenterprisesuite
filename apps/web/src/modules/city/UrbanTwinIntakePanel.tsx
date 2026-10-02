import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getUrbanTwinIntakeCapabilities,
  registerUrbanTwinBinding,
  registerUrbanTwinEntity,
  verifyUrbanTwinTarget
} from './urbanTwinIntakeApi';
import type { UrbanTwinBinding, UrbanTwinEntity, UrbanTwinEntityType } from './urbanTwinRepository';
import './urbanTwinIntake.css';

const ENTITY_TYPES: UrbanTwinEntityType[] = ['district','site','building','floor','space','asset','infrastructure'];
const BINDING_TYPES = ['cleanscan','device','gps','work','sensor','network','facility'] as const;

type Props = {
  entities: UrbanTwinEntity[];
  bindings: UrbanTwinBinding[];
  onChanged: () => Promise<void> | void;
};

function evidenceLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 20);
}

export function UrbanTwinIntakePanel({ entities, bindings, onChanged }: Props) {
  const [canManage, setCanManage] = useState(false);
  const [canVerify, setCanVerify] = useState(false);
  const [capabilityState, setCapabilityState] = useState<'loading'|'ready'|'error'>('loading');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const [entityType, setEntityType] = useState<UrbanTwinEntityType>('building');
  const [entityName, setEntityName] = useState('');
  const [parentId, setParentId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const [bindingEntityId, setBindingEntityId] = useState('');
  const [bindingType, setBindingType] = useState<(typeof BINDING_TYPES)[number]>('device');
  const [adapter, setAdapter] = useState('');
  const [externalRef, setExternalRef] = useState('');

  const [verifyTarget, setVerifyTarget] = useState('');
  const [evidence, setEvidence] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getUrbanTwinIntakeCapabilities()
      .then((result) => {
        if (cancelled) return;
        setCanManage(result.can_manage);
        setCanVerify(result.can_verify);
        setCapabilityState('ready');
      })
      .catch(() => {
        if (!cancelled) setCapabilityState('error');
      });
    return () => { cancelled = true; };
  }, []);

  const targetOptions = useMemo(() => [
    ...entities.map((entity) => ({ value: `entity:${entity.id}`, label: `Entity · ${entity.name} · ${entity.verification_state}` })),
    ...bindings.map((binding) => ({
      value: `binding:${binding.id}`,
      label: `Binding · ${binding.binding_type} · ${binding.adapter} · ${binding.verification_state}`
    }))
  ], [entities, bindings]);

  async function run(label: string, operation: () => Promise<unknown>) {
    setBusy(label);
    setMessage('');
    try {
      await operation();
      await onChanged();
      setMessage(`${label} completed. State remains evidence-bound.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'operation_failed');
    } finally {
      setBusy('');
    }
  }

  function submitEntity(event: FormEvent) {
    event.preventDefault();
    void run('Entity registration', async () => {
      await registerUrbanTwinEntity({
        entity_type: entityType,
        name: entityName,
        parent_id: parentId || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null
      });
      setEntityName('');
      setLatitude('');
      setLongitude('');
    });
  }

  function submitBinding(event: FormEvent) {
    event.preventDefault();
    void run('Binding registration', async () => {
      await registerUrbanTwinBinding({
        entity_id: bindingEntityId,
        binding_type: bindingType,
        adapter,
        external_ref: externalRef
      });
      setAdapter('');
      setExternalRef('');
    });
  }

  function submitVerification(event: FormEvent) {
    event.preventDefault();
    const [targetType, targetId] = verifyTarget.split(':', 2);
    void run('Evidence review', async () => {
      await verifyUrbanTwinTarget({
        target_type: targetType as 'entity' | 'binding',
        target_id: targetId,
        evidence_refs: evidenceLines(evidence)
      });
      setEvidence('');
    });
  }

  return (
    <section className="urban-twin-intake urban-twin-card" aria-labelledby="urban-twin-intake-title">
      <div className="urban-twin-heading">
        <div>
          <p className="eyebrow">Governed physical intake</p>
          <h2 id="urban-twin-intake-title">Register first. Verify separately.</h2>
        </div>
        <span>{capabilityState === 'ready' ? (canVerify ? 'manage + verify' : canManage ? 'manage' : 'read only') : capabilityState}</span>
      </div>

      <p className="urban-twin-intake-note">
        Registration never marks an asset live. Verification requires an owner/admin evidence review.
        A verified binding still does not imply active telemetry unless authenticated observations exist.
      </p>

      <div className="urban-twin-intake-grid">
        <form onSubmit={submitEntity}>
          <strong>1 · Register entity</strong>
          <label>Type<select value={entityType} onChange={(e) => setEntityType(e.target.value as UrbanTwinEntityType)}>{ENTITY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Name<input required maxLength={180} value={entityName} onChange={(e) => setEntityName(e.target.value)} placeholder="Real facility or asset name" /></label>
          <label>Parent<select value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">No parent</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.entity_type} · {entity.name}</option>)}</select></label>
          <div className="urban-twin-coordinate-row">
            <label>Latitude<input inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Optional" /></label>
            <label>Longitude<input inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Optional" /></label>
          </div>
          <button disabled={!canManage || Boolean(busy)} type="submit">{busy === 'Entity registration' ? 'Registering…' : 'Register unverified entity'}</button>
        </form>

        <form onSubmit={submitBinding}>
          <strong>2 · Bind authoritative source</strong>
          <label>Entity<select required value={bindingEntityId} onChange={(e) => setBindingEntityId(e.target.value)}><option value="">Select entity</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
          <label>Binding type<select value={bindingType} onChange={(e) => setBindingType(e.target.value as typeof bindingType)}>{BINDING_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Adapter<input required maxLength={120} value={adapter} onChange={(e) => setAdapter(e.target.value)} placeholder="e.g. device-dna-linux" /></label>
          <label>External reference<input required maxLength={240} value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="Provider/device/scan identifier" /></label>
          <button disabled={!canManage || !entities.length || Boolean(busy)} type="submit">{busy === 'Binding registration' ? 'Binding…' : 'Register unverified binding'}</button>
        </form>

        <form onSubmit={submitVerification}>
          <strong>3 · Evidence review</strong>
          <label>Target<select required value={verifyTarget} onChange={(e) => setVerifyTarget(e.target.value)}><option value="">Select target</option>{targetOptions.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}</select></label>
          <label>Evidence references<textarea required rows={5} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="One non-secret evidence reference per line" /></label>
          <small>Do not paste passwords, bearer tokens, API keys or service-role secrets.</small>
          <button disabled={!canVerify || !targetOptions.length || Boolean(busy)} type="submit">{busy === 'Evidence review' ? 'Verifying…' : 'Verify after review'}</button>
        </form>
      </div>

      {message ? <div className="urban-twin-intake-message" role="status">{message}</div> : null}
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  enqueueLocalDeviceCommand,
  listLocalDevices,
  type AtlasLocalDevice
} from './localControlApi';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function stringValue(value: unknown, fallback = 'Unknown') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function reportFor(device: AtlasLocalDevice) {
  const report = record(device.metadata?.device_dna);
  return report.schema_version === 'atlas.device-dna.v1' ? report : null;
}

function reportSummary(device: AtlasLocalDevice) {
  const report = reportFor(device);
  if (!report) return null;
  const system = record(report.system);
  const compute = record(report.compute);
  const firmware = record(report.firmware);
  const storage = record(report.storage);
  const battery = record(report.battery);
  const integrity = record(report.integrity);
  const disks = Array.isArray(storage.disks) ? storage.disks : [];

  return {
    report,
    manufacturer: stringValue(system.manufacturer, 'Manufacturer unavailable'),
    productName: stringValue(system.product_name, 'Product unavailable'),
    cpuModel: stringValue(compute.cpu_model),
    logicalCores: numberValue(compute.logical_cores),
    memoryGb: numberValue(compute.memory_gb),
    profile: stringValue(report.runtime_profile, 'standard').toUpperCase(),
    bootMode: stringValue(firmware.boot_mode),
    secureBoot: stringValue(firmware.secure_boot),
    tpmPresent: firmware.tpm_present === true,
    batteryPresent: battery.present === true,
    batteryCapacity: numberValue(battery.capacity_percent),
    diskCount: disks.length,
    storageObserved: storage.observed === true,
    observedAt: stringValue(report.observed_at),
    digest: stringValue(integrity.content_digest_sha256, ''),
    hardwareAttested: integrity.hardware_attested === true
  };
}

export function DeviceDnaEvidencePanel() {
  const [devices, setDevices] = useState<AtlasLocalDevice[]>([]);
  const [status, setStatus] = useState('Loading Device DNA evidence…');
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);

  async function refresh() {
    try {
      const rows = await listLocalDevices();
      setDevices(rows);
      const count = rows.filter((device) => device.adapter.startsWith('device-dna-') && reportFor(device)).length;
      setStatus(
        count
          ? `${count} evidence-backed Device DNA report(s) available.`
          : 'No Linux or Windows Device DNA report has been observed by an enrolled ATLAS Local Agent yet.'
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : 'device_dna_load_failed';
      setStatus(code.replaceAll('_', ' '));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const observed = useMemo(
    () => devices
      .filter((device) => device.adapter.startsWith('device-dna-'))
      .map((device) => ({ device, summary: reportSummary(device) }))
      .filter((item): item is { device: AtlasLocalDevice; summary: NonNullable<ReturnType<typeof reportSummary>> } => Boolean(item.summary)),
    [devices]
  );

  async function requestFreshReport(device: AtlasLocalDevice) {
    setBusyDeviceId(device.id);
    try {
      const result = await enqueueLocalDeviceCommand({
        deviceId: device.id,
        agentId: device.agent_id,
        capability: 'device.dna.read',
        action: 'report.read',
        riskLevel: 'low'
      });
      setStatus(
        result.realtime.delivered > 0
          ? 'Fresh Device DNA observation queued and the realtime Local Agent was notified. Reload evidence after the command completes.'
          : 'Fresh Device DNA observation queued. Realtime is unavailable, so the Local Agent polling fallback will execute it.'
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : 'device_dna_refresh_failed';
      setStatus(code.replaceAll('_', ' '));
    } finally {
      setBusyDeviceId(null);
    }
  }

  return (
    <article className="feature-card wide" aria-labelledby="device-dna-evidence-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">ATLAS Device DNA · Evidence</p>
          <h2 id="device-dna-evidence-title">Observed hardware profile</h2>
        </div>
        <span className={observed.length ? 'status-chip' : 'status-chip warning'}>
          {observed.length ? 'Agent observed' : 'Evidence required'}
        </span>
      </div>

      <p>
        The Linux and Windows reference collectors read only bounded, non-secret system facts. A report is evidence-backed
        by an enrolled ATLAS Local Agent, but it is not hardware attestation and it does not prove full
        component health.
      </p>

      <div className="notice" role="status">{status}</div>

      <div className="filter-row">
        <button type="button" onClick={() => void refresh()} disabled={busyDeviceId !== null}>
          Reload evidence
        </button>
      </div>

      {observed.length ? (
        <div className="module-grid compact" aria-label="Observed Device DNA reports">
          {observed.map(({ device, summary }) => (
            <section className="module-card" key={device.id}>
              <span>{summary.manufacturer}</span>
              <strong>{summary.productName}</strong>
              <p>{summary.cpuModel}</p>
              <p>
                {summary.memoryGb ?? 'Unknown'} GB RAM · {summary.logicalCores ?? 'Unknown'} logical cores ·
                ATLAS {summary.profile}
              </p>
              <p>
                Boot: {summary.bootMode} · Secure Boot: {summary.secureBoot} ·
                TPM: {summary.tpmPresent ? 'present' : 'not observed'}
              </p>
              <p>
                Storage inventory: {summary.storageObserved ? `${summary.diskCount} disk(s)` : 'unavailable'} ·
                Battery: {summary.batteryPresent
                  ? `present${summary.batteryCapacity === null ? '' : ` · ${summary.batteryCapacity}%`}`
                  : 'not observed'}
              </p>
              <p>Observed: {summary.observedAt}</p>
              <p>
                Integrity: {summary.digest ? `${summary.digest.slice(0, 16)}…` : 'digest unavailable'} ·
                Hardware attested: {summary.hardwareAttested ? 'yes' : 'no'}
              </p>
              <button
                type="button"
                onClick={() => void requestFreshReport(device)}
                disabled={busyDeviceId !== null}
              >
                {busyDeviceId === device.id ? 'Queueing…' : 'Refresh from Local Agent'}
              </button>
            </section>
          ))}
        </div>
      ) : (
        <div className="notice">
          Install and enroll the ATLAS Local Agent on an authorized Linux or Windows computer. Device DNA stays
          fail-closed on other platforms until their native collectors are implemented and tested.
        </div>
      )}

      <div className="notice">
        Privacy boundary: the v1 report intentionally excludes serial numbers, product UUIDs, MAC/IP
        addresses, usernames, hostnames and mount paths.
      </div>
    </article>
  );
}

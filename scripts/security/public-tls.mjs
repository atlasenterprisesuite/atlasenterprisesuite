import tls from 'node:tls';

const DAY_MS = 86_400_000;
const HOSTS = Object.freeze(['www.atlasenterprisesuite.com', 'atlasenterprisesuite.com']);

function date(value) {
  if (!value || typeof value !== 'string') return null;
  const result = new Date(value);
  return Number.isFinite(result.getTime()) ? result : null;
}

export function evaluatePublicTlsCertificate(
  { hostname, authorized, peer, protocol },
  { now = new Date(), warningDays = 21, criticalDays = 7 } = {},
) {
  const current = new Date(now);
  const start = date(peer?.valid_from);
  const expiry = date(peer?.valid_to);
  if (!HOSTS.includes(hostname) || !Number.isFinite(current.getTime()) ||
      !Number.isSafeInteger(warningDays) || !Number.isSafeInteger(criticalDays) ||
      criticalDays < 1 || warningDays <= criticalDays) {
    return { hostname, status: 'blocked', code: 'invalid_probe_input' };
  }
  if (!authorized || !peer || tls.checkServerIdentity(hostname, peer)) {
    return { hostname, status: 'blocked', code: 'tls_identity_unverified' };
  }
  if (!['TLSv1.2','TLSv1.3'].includes(protocol)) {
    return { hostname, status: 'blocked', code: 'tls_protocol_rejected' };
  }
  if (!start || !expiry || start.getTime() > current.getTime()) {
    return { hostname, status: 'blocked', code: 'tls_validity_invalid' };
  }
  const remaining = (expiry.getTime() - current.getTime()) / DAY_MS;
  if (remaining <= 0) return { hostname, status: 'blocked', code: 'tls_certificate_expired' };
  if (remaining <= criticalDays) return { hostname, status: 'blocked', code: 'tls_certificate_expiring_critical' };
  if (remaining <= warningDays) return { hostname, status: 'warning', code: 'tls_certificate_renewal_due' };
  return { hostname, status: 'ready', code: 'tls_verified' };
}

export async function probePublicTls(hostname, { now = new Date() } = {}) {
  if (!HOSTS.includes(hostname)) return { hostname, status: 'blocked', code: 'hostname_not_allowed' };
  try {
    const observed = await new Promise((resolve, reject) => {
      const socket = tls.connect({
        host: hostname, port: 443, servername: hostname, minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      });
      socket.setTimeout(12_000, () => socket.destroy(new Error('tls_timeout')));
      socket.once('error', reject);
      socket.once('secureConnect', () => {
        const evidence = {
          hostname,
          authorized: socket.authorized === true,
          peer: socket.getPeerCertificate(false),
          protocol: socket.getProtocol(),
        };
        socket.end();
        resolve(evidence);
      });
    });
    return evaluatePublicTlsCertificate(observed, { now });
  } catch {
    return { hostname, status: 'blocked', code: 'tls_handshake_unverified' };
  }
}

async function main() {
  const results = await Promise.all(HOSTS.map(hostname => probePublicTls(hostname)));
  const blocked = results.some(item => item.status === 'blocked');
  const state = blocked ? 'blocked' : results.some(item => item.status === 'warning') ? 'warning' : 'ready';
  const report = { state, checked_at: new Date().toISOString(), results };
  console.log(JSON.stringify(report));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = await import('node:fs');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '### Public HTTPS certificate verification',
      ...results.map(item => '- ' + item.hostname + ': ' + item.status + ' (' + item.code + ')'),
      '- Chain trust, DNS identity and TLS >= 1.2 required',
      '',
    ].join('\n'));
  }
  if (blocked) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  main().catch(() => { console.error(JSON.stringify({ state: 'blocked', code: 'tls_probe_failed' })); process.exitCode = 2; });
}

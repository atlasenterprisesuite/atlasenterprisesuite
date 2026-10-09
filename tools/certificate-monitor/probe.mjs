import tls from 'node:tls';
import { createHash } from 'node:crypto';

const hostname = 'www.atlasenterprisesuite.com';
const port = 443;
const audience = 'atlas-certificate-monitor';
const endpoint = process.env.ATLAS_CERTIFICATE_INGEST_URL;
if (!endpoint || new URL(endpoint).origin !== 'https://ggmanzcgtlrvqfoccgsh.supabase.co') {
  throw new Error('approved_ingest_endpoint_required');
}
if (!process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || !process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
  throw new Error('github_oidc_required');
}

function safeText(value) {
  return typeof value === 'string' ? value.slice(0, 512) : null;
}
function probeTls() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (result, socket) => {
      if (done) return;
      done = true;
      socket?.destroy();
      resolve(result);
    };
    const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: true, timeout: 12000 }, () => {
      try {
        const peer = socket.getPeerCertificate();
        const fp = String(peer.fingerprint256 || '').replace(/:/g, '').toLowerCase();
        const notBefore = new Date(peer.valid_from).toISOString();
        const notAfter = new Date(peer.valid_to).toISOString();
        const allowed = Boolean(socket.authorized && fp.match(/^[a-f0-9]{64}$/) && Date.parse(notAfter) > Date.now());
        if (!allowed) return finish({ observation_status: 'tls_failure' }, socket);
        return finish({
          observation_status: 'verified_tls',
          certificate_sha256: fp,
          certificate_subject: safeText(JSON.stringify(peer.subject || {})),
          certificate_issuer: safeText(JSON.stringify(peer.issuer || {})),
          not_before: notBefore, not_after: notAfter, tls_protocol: socket.getProtocol() || 'unknown',
          hostname_verified: true, chain_verified: true
        }, socket);
      } catch {
        return finish({ observation_status: 'tls_failure' }, socket);
      }
    });
    socket.on('timeout', () => finish({ observation_status: 'tls_failure' }, socket));
    socket.on('error', () => finish({ observation_status: 'tls_failure' }, socket));
  });
}
const oidcUrl = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
oidcUrl.searchParams.set('audience', audience);
const tokenResponse = await fetch(oidcUrl, {
  headers: { authorization: 'Bearer ' + process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN },
  signal: AbortSignal.timeout(10000)
});
if (!tokenResponse.ok) throw new Error('github_oidc_token_unavailable');
const token = (await tokenResponse.json()).value;
if (typeof token !== 'string' || !token.includes('.')) throw new Error('github_oidc_token_invalid');
const observed = { hostname, port, observed_at: new Date().toISOString(), ...await probeTls() };
const result = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
  body: JSON.stringify(observed),
  signal: AbortSignal.timeout(15000)
});
const data = await result.json().catch(() => ({}));
if (!result.ok || data.ok !== true) throw new Error('certificate_evidence_ingestion_rejected:' + (data.error || result.status));
console.log(JSON.stringify({ host: hostname, status: observed.observation_status, evidence_id: data.evidence_id, sha256: createHash('sha256').update(JSON.stringify(observed)).digest('hex') }));
if (observed.observation_status !== 'verified_tls') {
  // Successful recording of a failed handshake is still a failed security verification.
  process.exitCode = 1;
}

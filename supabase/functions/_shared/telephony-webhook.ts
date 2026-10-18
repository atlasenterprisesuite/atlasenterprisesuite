function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type TelnyxWebhookHeaders = {
  signature: string;
  timestamp: string;
};

export function readTelnyxWebhookHeaders(headers: Headers): TelnyxWebhookHeaders {
  const signature = headers.get('telnyx-signature-ed25519') || '';
  const timestamp = headers.get('telnyx-timestamp') || '';
  if (!signature) throw new Error('webhook_signature_missing');
  if (!timestamp) throw new Error('webhook_timestamp_missing');
  return { signature, timestamp };
}

export async function verifyTelnyxWebhook(input: {
  rawBody: string;
  headers: Headers;
  publicKeyBase64: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): Promise<void> {
  const { signature, timestamp } = readTelnyxWebhookHeaders(input.headers);
  const timestampNumber = Number(timestamp);
  if (!Number.isInteger(timestampNumber)) throw new Error('webhook_timestamp_invalid');

  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = input.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - timestampNumber) > tolerance) {
    throw new Error('webhook_timestamp_outside_tolerance');
  }

  const publicKey = decodeBase64(input.publicKeyBase64);
  const signatureBytes = decodeBase64(signature);
  if (publicKey.byteLength !== 32) throw new Error('webhook_public_key_invalid');
  if (signatureBytes.byteLength !== 64) throw new Error('webhook_signature_invalid');

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    publicKey,
    { name: 'Ed25519' },
    false,
    ['verify']
  );

  const message = new TextEncoder().encode(`${timestamp}|${input.rawBody}`);
  const valid = await crypto.subtle.verify(
    'Ed25519',
    cryptoKey,
    signatureBytes,
    message
  );
  if (!valid) throw new Error('webhook_signature_mismatch');
}

import { describe, expect, it } from 'vitest';
import { verifyTelnyxWebhook } from '../../supabase/functions/_shared/telephony-webhook';

function b64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

describe('ATLAS Telnyx webhook verifier', () => {
  it('accepts an Ed25519 signature over timestamp|raw-body', async () => {
    const keys = await crypto.subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify']
    );
    const rawBody = JSON.stringify({ data: { id: 'evt-1' } });
    const timestamp = '1790467200';
    const message = new TextEncoder().encode(`${timestamp}|${rawBody}`);
    const signature = new Uint8Array(
      await crypto.subtle.sign('Ed25519', keys.privateKey, message)
    );
    const publicKey = new Uint8Array(
      await crypto.subtle.exportKey('raw', keys.publicKey)
    );

    const headers = new Headers({
      'telnyx-timestamp': timestamp,
      'telnyx-signature-ed25519': b64(signature)
    });

    await expect(
      verifyTelnyxWebhook({
        rawBody,
        headers,
        publicKeyBase64: b64(publicKey),
        nowSeconds: Number(timestamp)
      })
    ).resolves.toBeUndefined();
  });

  it('rejects replayed webhooks outside tolerance', async () => {
    const headers = new Headers({
      'telnyx-timestamp': '100',
      'telnyx-signature-ed25519': b64(new Uint8Array(64))
    });

    await expect(
      verifyTelnyxWebhook({
        rawBody: '{}',
        headers,
        publicKeyBase64: b64(new Uint8Array(32)),
        nowSeconds: 1000,
        toleranceSeconds: 300
      })
    ).rejects.toThrow('webhook_timestamp_outside_tolerance');
  });

  it('rejects missing verification headers', async () => {
    await expect(
      verifyTelnyxWebhook({
        rawBody: '{}',
        headers: new Headers(),
        publicKeyBase64: b64(new Uint8Array(32))
      })
    ).rejects.toThrow('webhook_signature_missing');
  });
});

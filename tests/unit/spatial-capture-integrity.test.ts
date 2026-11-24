import { describe, expect, it } from 'vitest';
import { sha256OfFile } from '../../apps/web/src/modules/city/spatialCaptureApi';

describe('spatial capture SHA-256', () => {
  it('calculates SHA-256 over original photo bytes (not filenames)', async () => {
    const file = new File([new Uint8Array([97,98,99])], 'image.jpg', {type:'image/jpeg'});
    const hash = await sha256OfFile(file);
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('fails closed when WebCrypto is unavailable', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    try {
      Object.defineProperty(globalThis, 'crypto', {configurable:true, value:{}});
      await expect(sha256OfFile(new File(['x'],'x.jpg'))).rejects.toThrow('secure_crypto_unavailable');
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
      else Reflect.deleteProperty(globalThis, 'crypto');
    }
  });
});

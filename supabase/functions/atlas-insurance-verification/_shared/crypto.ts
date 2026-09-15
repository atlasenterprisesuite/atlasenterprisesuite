import { insuranceError } from './errors.ts';

const encoder = new TextEncoder();
const OTP_RANGE = 1_000_000;
const UINT32_RANGE = 0x1_0000_0000;
const ACCEPT_BELOW = Math.floor(UINT32_RANGE / OTP_RANGE) * OTP_RANGE;

function otpSecret() {
  const secret = Deno.env.get('ATLAS_INSURANCE_OTP_SECRET') || '';
  if (secret.length < 32) throw insuranceError('verification_not_configured', 503);
  return secret;
}

export function generateVerificationCode() {
  const sample = new Uint32Array(1);
  do {
    crypto.getRandomValues(sample);
  } while (sample[0] >= ACCEPT_BELOW);
  return String(sample[0] % OTP_RANGE).padStart(6, '0');
}

async function hmacBytes(value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(otpSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashVerificationCode(challengeId: string, code: string) {
  return hex(await hmacBytes(`${challengeId}:${code}`));
}

export function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyVerificationCode(challengeId: string, code: string, storedDigest: string) {
  const candidate = await hashVerificationCode(challengeId, code);
  return constantTimeEqual(candidate, storedDigest);
}

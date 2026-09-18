const OTP_RANGE = 1_000_000;
const UINT32_RANGE = 0x1_0000_0000;
const ACCEPT_BELOW = Math.floor(UINT32_RANGE / OTP_RANGE) * OTP_RANGE;

export function generateVerificationCode() {
  const sample = new Uint32Array(1);
  do {
    crypto.getRandomValues(sample);
  } while (sample[0] >= ACCEPT_BELOW);
  return String(sample[0] % OTP_RANGE).padStart(6, '0');
}

export function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

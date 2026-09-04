export type TelecomErrorCode =
  | 'ADAPTER_UNAVAILABLE'
  | 'DEVICE_NOT_FOUND'
  | 'CAPABILITY_UNSUPPORTED'
  | 'INVALID_DESTINATION'
  | 'SCOPE_MISMATCH'
  | 'NETWORK_REJECTED'
  | 'VERIFICATION_MISMATCH';

export class TelecomError extends Error {
  constructor(public readonly code: TelecomErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'TelecomError';
  }
}

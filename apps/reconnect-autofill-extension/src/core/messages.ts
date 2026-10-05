import type { WorkSearchRecord } from './types';

export const RECONNECT_MESSAGE_TYPES = [
  'ATLAS_RECONNECT_STATUS',
  'ATLAS_RECONNECT_FILL_CURRENT',
  'ATLAS_RECONNECT_FILL_VERIFIED',
  'ATLAS_RECONNECT_CLEAR_REVIEW'
] as const;

export type ReconnectMessageType = (typeof RECONNECT_MESSAGE_TYPES)[number];

export type ReconnectExtensionMessage =
  | { type: 'ATLAS_RECONNECT_STATUS' }
  | { type: 'ATLAS_RECONNECT_FILL_CURRENT'; record: WorkSearchRecord }
  | { type: 'ATLAS_RECONNECT_FILL_VERIFIED'; records: WorkSearchRecord[] }
  | { type: 'ATLAS_RECONNECT_CLEAR_REVIEW' };

export type ReconnectExtensionResponse =
  | { ok: true; status: 'ready' | 'filled' | 'cleared'; detail?: unknown }
  | { ok: false; status: 'blocked' | 'error'; reason: string; detail?: unknown };

/**
 * ATLAS Voice Alexa adapter: simulation-only protocol preview.
 *
 * This module NEVER verifies Amazon HTTPS signatures or invokes ATLAS services.
 * DO NOT mount it on a public HTTP endpoint. A production ingress must first
 * verify Amazon's certificate chain, Signature-256 over raw bytes, request
 * timestamp, skill ID, and linked ATLAS tenant/user authorization.
 *
 * The only successful responses here are static, non-personalized previews.
 */

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function getString(obj: UnknownRecord | null, key: string): string | null {
  const value = obj?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function at(root: UnknownRecord | null, ...keys: string[]): UnknownRecord | null {
  let cursor = root;
  for (const key of keys) cursor = record(cursor?.[key]);
  return cursor;
}

export type AlexaPreviewOutcome = 'blocked' | 'launch' | 'help' | 'status_unavailable';

export type AlexaPreviewResult = {
  stage: 'simulation';
  allowed: boolean;
  outcome: AlexaPreviewOutcome;
  response: {
    version: '1.0';
    response: {
      outputSpeech: { type: 'PlainText'; text: string };
      shouldEndSession: boolean;
    };
  };
};

export type AlexaPreviewOptions = {
  /** Expected Alexa skill ID supplied by controlled test configuration. */
  skillId: string;
  /** Injected time for deterministic tests; not a signature check. */
  nowMs: number;
};

function say(
  outcome: AlexaPreviewOutcome,
  speech: string,
  shouldEndSession: boolean
): AlexaPreviewResult {
  return {
    stage: 'simulation',
    allowed: outcome !== 'blocked',
    outcome,
    response: {
      version: '1.0',
      response: {
        outputSpeech: { type: 'PlainText', text: speech },
        shouldEndSession
      }
    }
  };
}

function block(): AlexaPreviewResult {
  return say('blocked', 'Solicitud no disponible.', true);
}

/**
 * Static preview only: this is not an Alexa webhook or an authentication gate.
 *
 * There is intentionally no network client, skill registration, user/account
 * linking, API key, voice capture, conversation recording, or action dispatch.
 */
export function previewAlexaSkill(
  envelope: unknown,
  options: AlexaPreviewOptions
): AlexaPreviewResult {
  const input = record(envelope);
  const request = at(input, 'request');
  const sessionApplication = at(input, 'session', 'application');
  const contextApplication = at(input, 'context', 'System', 'application');

  const expected = typeof options?.skillId === 'string' ? options.skillId : '';
  if (!expected.startsWith('amzn1.ask.skill.') || expected.length < 30) return block();
  if (getString(sessionApplication, 'applicationId') !== expected) return block();
  if (getString(contextApplication, 'applicationId') !== expected) return block();
  if (getString(input, 'version') !== '1.0') return block();

  const id = getString(request, 'requestId');
  const timestamp = getString(request, 'timestamp');
  const type = getString(request, 'type');
  if (!id || id.length > 256 || !timestamp || !type) return block();

  // Reject both stale and future-dated requests (150 seconds maximum).
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(options?.nowMs) || !Number.isFinite(timestampMs)) return block();
  if (Math.abs(options.nowMs - timestampMs) > 150_000) return block();

  if (type === 'LaunchRequest') {
    return say('launch', 'Bienvenido a la demostración de ATLAS. Puedes pedir ayuda.', false);
  }

  if (type !== 'IntentRequest') return block();
  const intentName = getString(at(request, 'intent'), 'name');

  if (intentName === 'AMAZON.HelpIntent') {
    return say('help', 'Esta demostración solo permite ayuda y consultar disponibilidad.', false);
  }

  if (intentName === 'ATLAS.StatusIntent') {
    return say('status_unavailable', 'Estado no disponible: ATLAS no está vinculado a esta demostración.', true);
  }

  // Sensitive, arbitrary and unsupported intents are always denied.
  return block();
}

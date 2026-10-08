import { describe, expect, it } from 'vitest';
import { defaultAccessibilityProfile } from '../../apps/web/src/services/accessibilityProfile';
import { evaluateAccessibilityRecognitionGate } from '../../apps/web/src/services/accessibilityRecognitionGate';
import type { AccessibilityCapabilities } from '../../apps/web/src/types/accessibility';

const capabilities: AccessibilityCapabilities = {
  aslRecognition: 'available',
  aslAvatar: 'not_configured',
  liveCaptions: 'not_configured',
  brailleHardware: 'unavailable',
  haptics: 'unavailable',
  humanInterpreter: 'not_configured'
};
const profile = {
  ...defaultAccessibilityProfile('user-a'),
  preferredInput: 'asl' as const,
  preferredSignLanguage: 'ase'
};
const input = { text: 'Open Human Resources', confidence: 0.99, sensitive: false, signLanguage: 'ase' };

describe('accessibility recognition provider and language gate', () => {
  it('blocks recognition if provider is unconfigured or unavailable', () => {
    for (const state of ['not_configured', 'unavailable'] as const) {
      expect(evaluateAccessibilityRecognitionGate({ ...capabilities, aslRecognition: state }, profile, input))
        .toEqual({ allowed: false, reason: 'provider_not_configured' });
    }
  });
  it('blocks unmatched or missing source languages and unselected user languages', () => {
    expect(evaluateAccessibilityRecognitionGate(capabilities, profile, { ...input, signLanguage: 'vsl' }))
      .toEqual({ allowed: false, reason: 'sign_language_mismatch' });
    expect(evaluateAccessibilityRecognitionGate(capabilities, profile, { ...input, signLanguage: '' }))
      .toEqual({ allowed: false, reason: 'sign_language_mismatch' });
    expect(evaluateAccessibilityRecognitionGate(capabilities, { ...profile, preferredSignLanguage: null }, input))
      .toEqual({ allowed: false, reason: 'sign_language_not_selected' });
    expect(evaluateAccessibilityRecognitionGate(capabilities, { ...profile, preferredInput: 'text' }, input))
      .toEqual({ allowed: false, reason: 'sign_language_not_selected' });
  });
  it('blocks empty text and invalid confidence before the confidence engine', () => {
    for (const candidate of [
      { ...input, text: '  ' },
      { ...input, confidence: Number.NaN },
      { ...input, confidence: 1.1 },
      { ...input, confidence: -0.1 }
    ]) {
      expect(evaluateAccessibilityRecognitionGate(capabilities, profile, candidate))
        .toEqual({ allowed: false, reason: 'invalid_recognition_input' });
    }
  });
  it('passes only matching-language recognized input with an available adapter', () => {
    expect(evaluateAccessibilityRecognitionGate(capabilities, profile, input)).toEqual({ allowed: true });
  });
});

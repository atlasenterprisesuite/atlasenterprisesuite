import type { AccessibilityCapabilities, AccessibilityProfile, AccessibilityRecognitionInput } from '../types/accessibility';

export type AccessibilityRecognitionBlockReason =
  | 'provider_not_configured'
  | 'sign_language_not_selected'
  | 'sign_language_mismatch'
  | 'invalid_recognition_input';

export type AccessibilityRecognitionGate =
  | { allowed: true }
  | { allowed: false; reason: AccessibilityRecognitionBlockReason };

/**
 * Recognition events are untrusted until a real provider is explicitly marked
 * ready and the event's language matches the user's selected sign language.
 * The caller remains responsible for validating adapter credentials and
 * downstream authorization/RBAC.
 */
export function evaluateAccessibilityRecognitionGate(
  capabilities: AccessibilityCapabilities,
  profile: AccessibilityProfile,
  input: AccessibilityRecognitionInput
): AccessibilityRecognitionGate {
  if (capabilities.aslRecognition !== 'available') {
    return { allowed: false, reason: 'provider_not_configured' };
  }
  if (profile.preferredInput !== 'asl' || !profile.preferredSignLanguage) {
    return { allowed: false, reason: 'sign_language_not_selected' };
  }
  if (input.signLanguage !== profile.preferredSignLanguage) {
    return { allowed: false, reason: 'sign_language_mismatch' };
  }
  if (!input.text.trim() || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    return { allowed: false, reason: 'invalid_recognition_input' };
  }
  return { allowed: true };
}

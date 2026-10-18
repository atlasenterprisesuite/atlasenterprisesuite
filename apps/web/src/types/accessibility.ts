export type AccessibilityInputMode = 'asl' | 'voice' | 'text' | 'braille' | 'haptic';
export type AccessibilityOutputMode = 'text' | 'asl_avatar' | 'voice' | 'braille';
export type HapticIntensity = 'off' | 'low' | 'medium' | 'high';
export type AccessibilityCapabilityState = 'available' | 'unavailable' | 'not_configured';

export type AccessibilityProfile = {
  userId: string;
  preferredInput: AccessibilityInputMode;
  preferredOutput: AccessibilityOutputMode;
  /** ISO 639-3 code for the user's explicitly selected sign language. Never inferred from country or spoken language. */
  preferredSignLanguage: string | null;
  captionsEnabled: boolean;
  brailleMode: boolean;
  hapticIntensity: HapticIntensity;
  screenReaderOptimized: boolean;
  motionReduced: boolean;
  highContrast: boolean;
  textSizeScale: number;
};

export type AccessibilityRecognitionInput = {
  text: string;
  confidence: number;
  sensitive: boolean;
};

export type AccessibilityCapabilities = {
  aslRecognition: AccessibilityCapabilityState;
  aslAvatar: AccessibilityCapabilityState;
  liveCaptions: AccessibilityCapabilityState;
  brailleHardware: AccessibilityCapabilityState;
  haptics: AccessibilityCapabilityState;
  humanInterpreter: AccessibilityCapabilityState;
};

export type AccessibilityAction =
  | 'EXECUTE_ACCESSIBILITY_ACTION'
  | 'ACCESSIBILITY_PROFILE_UPDATED'
  | 'ACCESSIBILITY_CONFIRM_INTERPRETATION'
  | 'ACCESSIBILITY_INTERPRETATION_BLOCKED'
  | 'ACCESSIBILITY_ESCALATE_HUMAN'
  | 'ACCESSIBILITY_CAPTIONS_REQUESTED';

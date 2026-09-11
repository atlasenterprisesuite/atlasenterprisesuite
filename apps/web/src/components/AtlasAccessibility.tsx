import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AtlasConfidenceEngine } from '../services/AtlasConfidenceEngine';
import type {
  AccessibilityAction,
  AccessibilityCapabilities,
  AccessibilityCapabilityState,
  AccessibilityProfile,
  AccessibilityRecognitionInput,
  HapticIntensity
} from '../types/accessibility';

interface AtlasAccessibilityProps {
  initialProfile: AccessibilityProfile;
  onProfileChange: (profile: AccessibilityProfile) => void;
  onActionTriggered: (action: AccessibilityAction, payload?: Record<string, unknown>) => void;
  capabilities?: Partial<AccessibilityCapabilities>;
  recognitionInput?: AccessibilityRecognitionInput | null;
}

type RecognitionState = 'idle' | 'ready' | 'confirmation' | 'blocked';

const CAPABILITY_LABELS: Array<[keyof AccessibilityCapabilities, string]> = [
  ['aslRecognition', 'ASL recognition'],
  ['aslAvatar', 'ASL avatar'],
  ['liveCaptions', 'Live captions'],
  ['brailleHardware', 'Braille hardware'],
  ['haptics', 'Haptics'],
  ['humanInterpreter', 'Human interpreter']
];

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'select:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function defaultCapabilities(): AccessibilityCapabilities {
  const hasVibration = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  return {
    aslRecognition: 'not_configured',
    aslAvatar: 'not_configured',
    liveCaptions: 'not_configured',
    brailleHardware: 'unavailable',
    haptics: hasVibration ? 'available' : 'unavailable',
    humanInterpreter: 'not_configured'
  };
}

function capabilityText(state: AccessibilityCapabilityState) {
  if (state === 'available') return 'Available';
  if (state === 'unavailable') return 'Unavailable';
  return 'Not configured';
}

export function AtlasAccessibility({
  initialProfile,
  onProfileChange,
  onActionTriggered,
  capabilities: capabilityOverrides,
  recognitionInput
}: AtlasAccessibilityProps) {
  const dialogTitleId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [profile, setProfile] = useState<AccessibilityProfile>(initialProfile);
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle');
  const [pendingRecognition, setPendingRecognition] = useState<AccessibilityRecognitionInput | null>(null);

  const capabilities = useMemo(
    () => ({ ...defaultCapabilities(), ...(capabilityOverrides || {}) }),
    [capabilityOverrides]
  );

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    if (!recognitionInput) return;
    const evaluation = AtlasConfidenceEngine.evaluate(recognitionInput.confidence);
    setTranscript(recognitionInput.text);
    setConfidence(recognitionInput.confidence);

    if (!evaluation.actionRecommended) {
      setPendingRecognition(recognitionInput);
      setRecognitionState('blocked');
      onActionTriggered('ACCESSIBILITY_INTERPRETATION_BLOCKED', {
        text: recognitionInput.text,
        confidence: recognitionInput.confidence,
        sensitive: recognitionInput.sensitive
      });
      return;
    }

    if (evaluation.requiresConfirmation || recognitionInput.sensitive) {
      setPendingRecognition(recognitionInput);
      setRecognitionState('confirmation');
      return;
    }

    setPendingRecognition(null);
    setRecognitionState('ready');
    onActionTriggered('EXECUTE_ACCESSIBILITY_ACTION', {
      text: recognitionInput.text,
      confidence: recognitionInput.confidence,
      sensitive: false,
      confirmed: false
    });
  }, [recognitionInput, onActionTriggered]);

  const closeAccessibilityCenter = () => {
    setIsOpen(false);
    launcherRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAccessibilityCenter();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const keepFocusInsideDialog = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === dialogRef.current) {
      event.preventDefault();
      first.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const updateProfile = (updated: AccessibilityProfile) => {
    setProfile(updated);
    onProfileChange(updated);
    onActionTriggered('ACCESSIBILITY_PROFILE_UPDATED', { userId: updated.userId });
  };

  const enableCaptions = () => {
    if (!profile.captionsEnabled) updateProfile({ ...profile, captionsEnabled: true });
    onActionTriggered('ACCESSIBILITY_CAPTIONS_REQUESTED', {
      providerState: capabilities.liveCaptions
    });
  };

  const setHaptics = (intensity: HapticIntensity) => {
    updateProfile({ ...profile, hapticIntensity: intensity });
    if (intensity !== 'off' && capabilities.haptics === 'available' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(intensity === 'low' ? 40 : intensity === 'medium' ? 80 : 120);
    }
  };

  const confirmInterpretation = () => {
    if (!pendingRecognition || recognitionState !== 'confirmation') return;
    const payload = {
      text: pendingRecognition.text,
      confidence: pendingRecognition.confidence,
      sensitive: pendingRecognition.sensitive,
      confirmed: true
    };
    onActionTriggered('ACCESSIBILITY_CONFIRM_INTERPRETATION', payload);
    onActionTriggered('EXECUTE_ACCESSIBILITY_ACTION', payload);
    setRecognitionState('ready');
    setPendingRecognition(null);
  };

  const humanInterpreterAvailable = capabilities.humanInterpreter === 'available';
  const requestHumanInterpreter = () => {
    if (!humanInterpreterAvailable) return;
    onActionTriggered('ACCESSIBILITY_ESCALATE_HUMAN', {
      userId: profile.userId,
      requestedAt: new Date().toISOString()
    });
  };

  return (
    <div className="atlas-accessibility-layer" data-testid="atlas-accessibility-layer">
      <button
        ref={launcherRef}
        type="button"
        className="atlas-accessibility-launcher"
        onClick={() => setIsOpen(true)}
        aria-label="Open accessibility communication center"
      >
        <span aria-hidden="true">◉</span>
        <span>Accessibility</span>
      </button>

      {isOpen && (
        <div className="atlas-accessibility-backdrop" onMouseDown={(event) => {
          if (event.currentTarget === event.target) closeAccessibilityCenter();
        }}>
          <section
            ref={dialogRef}
            tabIndex={-1}
            className="atlas-accessibility-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            onKeyDown={keepFocusInsideDialog}
          >
            <div className="atlas-accessibility-heading">
              <div>
                <p className="eyebrow">ATLAS Connect</p>
                <h2 id={dialogTitleId}>Accessibility Communication Center</h2>
                <p>Communication adapts to functional preferences without requiring a medical diagnosis.</p>
              </div>
              <button type="button" className="icon-button" onClick={closeAccessibilityCenter} aria-label="Close accessibility communication center">×</button>
            </div>

            <div className="accessibility-mode-summary">
              <span><strong>Input</strong>{profile.preferredInput.toUpperCase()}</span>
              <span><strong>Output</strong>{profile.preferredOutput.replace('_', ' ')}</span>
              <span><strong>Captions</strong>{profile.captionsEnabled ? 'Enabled' : 'Off'}</span>
            </div>

            <div className="accessibility-provider-boundary" aria-label="Accessibility provider status">
              <h3>Capability status</h3>
              <div className="accessibility-capability-grid">
                {CAPABILITY_LABELS.map(([key, label]) => (
                  <div className="accessibility-capability" key={key}>
                    <span>{label}</span>
                    <strong data-state={capabilities[key]}>{capabilityText(capabilities[key])}</strong>
                  </div>
                ))}
              </div>
              {capabilities.aslAvatar !== 'available' && (
                <p className="accessibility-boundary-note">ASL avatar rendering is not active until a verified renderer is configured.</p>
              )}
            </div>

            <div className="accessibility-transcript" aria-live="polite" aria-atomic="true">
              <div className="accessibility-transcript-heading">
                <h3>Interpretation</h3>
                {confidence !== null && <span className="status-chip neutral">{Math.round(confidence * 100)}% confidence</span>}
              </div>
              <p>{transcript || 'No recognition provider input is currently available.'}</p>

              {recognitionState === 'confirmation' && (
                <div className="accessibility-decision warning" role="status">
                  <strong>Confirmation required</strong>
                  <p>The interpretation is not allowed to trigger an action until you confirm it.</p>
                  <button type="button" onClick={confirmInterpretation}>Confirm interpreted action</button>
                </div>
              )}

              {recognitionState === 'blocked' && (
                <div className="accessibility-decision blocked" role="alert">
                  <strong>Automation blocked</strong>
                  <p>The recognition confidence is too low for ATLAS to execute the interpreted action.</p>
                </div>
              )}
            </div>

            <div className="accessibility-quick-actions" aria-label="Accessibility quick actions">
              <button type="button" onClick={enableCaptions}>{profile.captionsEnabled ? 'Captions enabled' : 'Enable captions'}</button>
              <label className="accessibility-inline-field">
                <span>Haptic intensity</span>
                <select value={profile.hapticIntensity} onChange={(event) => setHaptics(event.target.value as HapticIntensity)}>
                  <option value="off">Off</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <button type="button" onClick={requestHumanInterpreter} disabled={!humanInterpreterAvailable}>Request human interpreter</button>
              <Link className="text-link" to="/settings/accessibility/communication" onClick={() => setIsOpen(false)}>Communication Settings</Link>
            </div>

            {!humanInterpreterAvailable && (
              <p className="accessibility-boundary-note">Interpreter provider is not configured. ATLAS will not claim that a human interpreter is connected.</p>
            )}
          </section>
        </div>
      )}

      {profile.captionsEnabled && (
        <div className="atlas-live-captions" role="status" aria-live="polite">
          <strong>Captions</strong>
          <span>{transcript || (capabilities.liveCaptions === 'available'
            ? 'Waiting for verified caption provider input.'
            : 'Enabled as a preference; live speech provider is not configured.')}</span>
        </div>
      )}
    </div>
  );
}

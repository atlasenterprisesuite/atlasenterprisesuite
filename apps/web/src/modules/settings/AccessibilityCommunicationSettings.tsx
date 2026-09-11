import { useEffect, useMemo, useState } from 'react';
import {
  loadAccessibilityProfile,
  loadAccessibilityProfileRemote,
  resolveAccessibilityUserId,
  saveAccessibilityProfile,
  syncAccessibilityProfileRemote
} from '../../services/accessibilityProfile';
import type { AccessibilitySyncStatus } from '../../services/accessibilityProfile';
import type {
  AccessibilityInputMode,
  AccessibilityOutputMode,
  AccessibilityProfile,
  HapticIntensity
} from '../../types/accessibility';
import { signLanguageRegistry } from '../../../../../data/accessibility/sign-languages';

interface Props {
  profile: AccessibilityProfile;
  onUpdate: (updated: AccessibilityProfile) => void;
}

export function AccessibilityCommunicationSettings({ profile, onUpdate }: Props) {
  const signLanguageOptions = useMemo(() => {
    const unique = new Map<string, { iso639_3: string; languageName: string; acronym: string }>();
    for (const language of signLanguageRegistry) {
      if (!unique.has(language.iso639_3)) {
        unique.set(language.iso639_3, {
          iso639_3: language.iso639_3,
          languageName: language.languageName,
          acronym: language.acronym
        });
      }
    }
    return [...unique.values()].sort((a, b) => a.languageName.localeCompare(b.languageName));
  }, []);

  return (
    <div className="settings-section accessibility-settings-section">
      <div className="settings-grid">
        <label className="field" htmlFor="accessibility-preferred-input">
          <span>Preferred input</span>
          <select
            id="accessibility-preferred-input"
            value={profile.preferredInput}
            onChange={(event) => onUpdate({ ...profile, preferredInput: event.target.value as AccessibilityInputMode })}
          >
            <option value="asl">Sign language</option>
            <option value="voice">Voice</option>
            <option value="text">Text</option>
            <option value="braille">Braille</option>
            <option value="haptic">Haptic</option>
          </select>
        </label>

        <label className="field" htmlFor="accessibility-preferred-output">
          <span>Preferred output</span>
          <select
            id="accessibility-preferred-output"
            value={profile.preferredOutput}
            onChange={(event) => onUpdate({ ...profile, preferredOutput: event.target.value as AccessibilityOutputMode })}
          >
            <option value="text">Text</option>
            <option value="asl_avatar">Sign-language avatar + text</option>
            <option value="voice">Synthetic voice</option>
            <option value="braille">Braille</option>
          </select>
        </label>

        <label className="field" htmlFor="accessibility-preferred-sign-language">
          <span>Preferred sign language</span>
          <select
            id="accessibility-preferred-sign-language"
            value={profile.preferredSignLanguage ?? ''}
            onChange={(event) => onUpdate({ ...profile, preferredSignLanguage: event.target.value || null })}
            aria-describedby="accessibility-sign-language-help"
          >
            <option value="">Not selected</option>
            {signLanguageOptions.map((language) => (
              <option key={language.iso639_3} value={language.iso639_3}>
                {language.languageName} ({language.acronym}) · {language.iso639_3}
              </option>
            ))}
          </select>
          <small id="accessibility-sign-language-help">ATLAS never infers this choice from your country or spoken language.</small>
        </label>

        <label className="field" htmlFor="accessibility-text-size">
          <span>Text size</span>
          <select
            id="accessibility-text-size"
            value={String(profile.textSizeScale)}
            onChange={(event) => onUpdate({ ...profile, textSizeScale: Number(event.target.value) })}
          >
            <option value="0.875">87.5%</option>
            <option value="1">100%</option>
            <option value="1.125">112.5%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="2">200%</option>
          </select>
        </label>

        <label className="field" htmlFor="accessibility-haptic-intensity">
          <span>Haptic intensity</span>
          <select
            id="accessibility-haptic-intensity"
            value={profile.hapticIntensity}
            onChange={(event) => onUpdate({ ...profile, hapticIntensity: event.target.value as HapticIntensity })}
          >
            <option value="off">Off</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>

      <div className="accessibility-toggle-list">
        <label><input type="checkbox" checked={profile.captionsEnabled} onChange={(event) => onUpdate({ ...profile, captionsEnabled: event.target.checked })} />Always show captions</label>
        <label><input type="checkbox" checked={profile.screenReaderOptimized} onChange={(event) => onUpdate({ ...profile, screenReaderOptimized: event.target.checked })} />Screen-reader optimized navigation</label>
        <label><input type="checkbox" checked={profile.motionReduced} onChange={(event) => onUpdate({ ...profile, motionReduced: event.target.checked })} />Reduce motion</label>
        <label><input type="checkbox" checked={profile.highContrast} onChange={(event) => onUpdate({ ...profile, highContrast: event.target.checked })} />High contrast</label>
        <label><input type="checkbox" checked={profile.brailleMode} onChange={(event) => onUpdate({ ...profile, brailleMode: event.target.checked })} />Prefer Braille-compatible output</label>
      </div>

      <div className="notice accessibility-settings-notice">
        <strong>Provider boundaries</strong>
        <p>Sign-language recognition and avatar rendering require a provider validated for the specific selected language before ATLAS can represent them as active.</p>
        <p>Braille hardware support requires a compatible detected device and validation; selecting a preference does not claim a device is connected.</p>
      </div>
    </div>
  );
}

function syncStatusText(status: AccessibilitySyncStatus | 'loading' | 'saving') {
  if (status === 'synced') return 'Synced to your ATLAS account.';
  if (status === 'failed') return 'Saved locally; ATLAS account sync is currently unavailable.';
  if (status === 'saving') return 'Saving accessibility preferences…';
  if (status === 'loading') return 'Checking your ATLAS accessibility preferences…';
  return 'Saved on this device. Sign in to synchronize across ATLAS sessions.';
}

export function AccessibilityCommunicationSettingsPage() {
  const userId = resolveAccessibilityUserId();
  const [profile, setProfile] = useState(() => loadAccessibilityProfile(userId));
  const [syncStatus, setSyncStatus] = useState<AccessibilitySyncStatus | 'loading' | 'saving'>('loading');

  useEffect(() => {
    let cancelled = false;
    loadAccessibilityProfileRemote(userId)
      .then((remoteProfile) => {
        if (cancelled) return;
        if (remoteProfile) {
          setProfile(saveAccessibilityProfile(remoteProfile));
          setSyncStatus('synced');
        } else {
          setSyncStatus('local-only');
        }
      })
      .catch(() => {
        if (!cancelled) setSyncStatus('failed');
      });
    return () => { cancelled = true; };
  }, [userId]);

  const updateProfile = (updated: AccessibilityProfile) => {
    const normalized = saveAccessibilityProfile(updated);
    setProfile(normalized);
    setSyncStatus('saving');
    void syncAccessibilityProfileRemote(normalized).then(setSyncStatus);
  };

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">Settings → Accessibility → Communication</p>
        <h1>Accessibility Communication</h1>
        <p>Choose how ATLAS should receive information, respond and present content. These are functional preferences; no medical diagnosis is required.</p>
      </header>
      <div className="notice" role="status" aria-live="polite">{syncStatusText(syncStatus)}</div>
      <AccessibilityCommunicationSettings profile={profile} onUpdate={updateProfile} />
    </section>
  );
}

import type { AtlasAssistantUiState, AtlasCapabilityState } from '../../assistant/types';

type AtlasAssistantLauncherProps = {
  state: AtlasAssistantUiState;
  textCapability: AtlasCapabilityState;
  providerLabel: string;
  onOpen: () => void;
};

export function AtlasAssistantLauncher({ state, textCapability, providerLabel, onOpen }: AtlasAssistantLauncherProps) {
  return (
    <button
      type="button"
      className={`atlas-assistant-launcher state-${state} capability-${textCapability}`}
      aria-label={`Open ATLAS Assistant, Intelligence ${providerLabel}`}
      onClick={onOpen}
    >
      <img src="/atlas-avatar-particle.svg" alt="" />
      <span className="atlas-assistant-launcher-status" aria-hidden="true" />
    </button>
  );
}

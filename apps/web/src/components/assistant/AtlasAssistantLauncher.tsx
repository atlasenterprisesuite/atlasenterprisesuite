import type { AtlasAssistantUiState, AtlasCapabilityState } from '../../assistant/types';

type AtlasAssistantLauncherProps = {
  state: AtlasAssistantUiState;
  textCapability: AtlasCapabilityState;
  onOpen: () => void;
};

export function AtlasAssistantLauncher({ state, textCapability, onOpen }: AtlasAssistantLauncherProps) {
  const capabilityLabel = textCapability === 'ready'
    ? 'ready'
    : textCapability === 'configuration-required'
      ? 'configuration required'
      : textCapability === 'permission-required'
        ? 'permission required'
        : 'unavailable';

  return (
    <button
      type="button"
      className={`atlas-assistant-launcher state-${state} capability-${textCapability}`}
      aria-label={`Open ATLAS Assistant, Intelligence ${capabilityLabel}`}
      onClick={onOpen}
    >
      <img src="/atlas/assistant/atlas-assistant-avatar.png" alt="" />
      <span className="atlas-assistant-launcher-status" aria-hidden="true" />
    </button>
  );
}

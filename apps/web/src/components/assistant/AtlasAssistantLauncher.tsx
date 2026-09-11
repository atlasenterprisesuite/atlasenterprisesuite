type AtlasAssistantLauncherProps = {
  state: 'closed' | 'idle' | 'thinking' | 'listening' | 'speaking' | 'error';
  onOpen: () => void;
};

export function AtlasAssistantLauncher({ state, onOpen }: AtlasAssistantLauncherProps) {
  return (
    <button
      type="button"
      className={`atlas-assistant-launcher state-${state}`}
      aria-label="Open ATLAS Assistant"
      onClick={onOpen}
    >
      <img src="/atlas/assistant/atlas-assistant-avatar.png" alt="" />
      <span className="atlas-assistant-launcher-status" aria-hidden="true" />
    </button>
  );
}

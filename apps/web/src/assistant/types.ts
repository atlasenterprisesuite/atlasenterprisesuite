export type AtlasAssistantCapability =
  | 'text'
  | 'microphone'
  | 'speech-output'
  | 'streaming'
  | 'native-personal-voice';

export type AtlasCapabilityState =
  | 'ready'
  | 'permission-required'
  | 'configuration-required'
  | 'unavailable';

export type AtlasAssistantUiState =
  | 'closed'
  | 'idle'
  | 'thinking'
  | 'listening'
  | 'speaking'
  | 'error';

export type AtlasAssistantContext = {
  pathname: string;
  module: string;
  organizationId: string;
  role: string;
};

export type AtlasAssistantMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

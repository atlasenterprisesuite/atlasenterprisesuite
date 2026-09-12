export type ProductionStatus =
  | 'draft' | 'validating' | 'blocked' | 'ready'
  | 'submitting' | 'generating' | 'completed' | 'failed';

export type CreatorPermission =
  | 'creator.read' | 'creator.write' | 'creator.generate'
  | 'creator.manage_providers' | 'creator.publish' | 'creator.admin';

export type ProviderId = 'seedance' | 'veo' | 'kling' | 'wan' | 'minimax';
export type ProviderConnectionState =
  | 'unconfigured' | 'configured-unverified' | 'ready'
  | 'unavailable' | 'insufficient-credit' | 'error';
export type ProviderGenerationMode = 'text2video' | 'image2video' | 'element2video';
export type AspectRatio = 'adaptive' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9';
export type ResolutionPreference = 'adaptive' | '480p' | '720p' | '1080p' | '2k' | '4k';

export type CameraSpec = {
  framing: string;
  angle: string;
  position: string;
  lens: string;
  focalLengthMm: number | null;
  depthOfField: string;
  movement: string;
  movementSpeed: string;
  focusTarget: string;
  orientationRule: string;
};

export type SubjectSpec = {
  id: string;
  label: string;
  description: string;
  identityLock: boolean;
  appearanceTraits: string[];
  materialTraits: string[];
  allowedTransformations: string[];
  forbiddenChanges: string[];
  referenceAssetIds: string[];
};

export type EnvironmentSpec = {
  locationDescription: string;
  timeOfDay: string;
  lightingEnvironment: string;
  weatherOrAtmosphere: string;
  backgroundConstraints: string[];
  referenceAssetIds: string[];
};

export type ShotSpec = {
  id: string;
  order: number;
  title: string;
  startSecond: number;
  endSecond: number;
  subjectIds: string[];
  action: string;
  camera: CameraSpec;
  motion: { direction: string; speedProfile: string; physicality: string };
  lighting: string;
  materials: string[];
  audioCueIds: string[];
  transitionIn: string;
  transitionOut: string;
  continuityNotes: string[];
  negativeConstraints: string[];
};

export type SceneSpec = {
  id: string;
  title: string;
  startSecond: number;
  endSecond: number;
  description: string;
  shots: ShotSpec[];
};

export type VisualStyleSpec = {
  photorealismLevel: string;
  cinematicStyle: string;
  textureStyle: string;
  colorPalette: string;
  contrastStyle: string;
  filmLook: string;
  grain: string;
  halation: string;
  surfaceDetail: string;
  lightingStyle: string;
};

export type MotionRule = {
  id: string;
  subjectId: string | null;
  movementDescription: string;
  direction: string;
  speedProfile: string;
  physicality: string;
  mustRemainContinuous: boolean;
};

export type AudioPlan = {
  musicDescription: string;
  ambientSound: string;
  soundEffects: string[];
  dialogue: string[];
  voiceReferenceAssetIds: string[];
  syncRules: string[];
};

export type NegativeConstraint = {
  id: string;
  scope: 'production' | 'scene' | 'shot' | 'subject';
  value: string;
  severity: 'preference' | 'warning' | 'blocking';
};

export type ContinuityRule = {
  id: string;
  ruleType:
    | 'identity' | 'orientation' | 'wardrobe-or-surface' | 'material'
    | 'lighting' | 'position' | 'camera-axis' | 'motion-direction'
    | 'damage-or-scar' | 'object-presence' | 'transformation-continuity' | 'custom';
  subjectId: string | null;
  description: string;
  startShotId: string | null;
  endShotId: string | null;
  severity: 'warning' | 'blocking';
};

export type ProductionSpec = {
  id: string;
  organizationId: string;
  createdByUserId: string;
  title: string;
  brief: string;
  status: ProductionStatus;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  resolutionPreference: ResolutionPreference;
  audioEnabled: boolean;
  subjects: SubjectSpec[];
  environment: EnvironmentSpec;
  scenes: SceneSpec[];
  continuityRules: ContinuityRule[];
  visualStyle: VisualStyleSpec;
  cameraDefaults: CameraSpec;
  motionRules: MotionRule[];
  audioPlan: AudioPlan;
  negativeConstraints: NegativeConstraint[];
  providerPreference: ProviderId | null;
  providerOverrides: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ValidationIssue = {
  code: string;
  severity: 'warning' | 'blocking';
  section: 'brief' | 'subjects' | 'environment' | 'shots' | 'continuity' | 'style' | 'camera' | 'audio' | 'provider' | 'review';
  message: string;
  targetId: string | null;
};

export type ValidationResult = {
  status: 'pass' | 'warning' | 'blocking';
  issues: ValidationIssue[];
};

export type ProviderCapability = {
  providerId: ProviderId;
  connectionState: ProviderConnectionState;
  modes: ProviderGenerationMode[];
  minDurationSeconds: number | null;
  maxDurationSeconds: number | null;
  aspectRatios: AspectRatio[];
  resolutions: ResolutionPreference[];
  audioSupport: boolean;
  imageReferenceSupport: boolean;
  videoReferenceSupport: boolean;
  audioReferenceSupport: boolean;
  maxImageReferences: number | null;
  maxVideoReferences: number | null;
  maxAudioReferences: number | null;
  startFrameSupport: boolean;
  endFrameSupport: boolean;
  costEstimatorAvailable: boolean;
  lastVerifiedAt: string | null;
};

export type ProviderReadiness = {
  providerId: ProviderId;
  displayName: string;
  connectionState: ProviderConnectionState;
  capability: ProviderCapability | null;
  estimatedCost: Record<string, unknown> | null;
  lastVerifiedAt: string | null;
};

export type CompiledProviderRequest = {
  providerId: ProviderId;
  prompt: string;
  normalizedParams: {
    durationSeconds: number;
    aspectRatio: AspectRatio;
    resolutionPreference: ResolutionPreference;
    audioEnabled: boolean;
  };
  unsupportedFeatures: string[];
  adaptationNotes: string[];
  readinessClaim: boolean;
};

export type ProductionSummary = Pick<ProductionSpec,
  | 'id' | 'title' | 'brief' | 'status' | 'durationSeconds'
  | 'aspectRatio' | 'resolutionPreference' | 'audioEnabled'
  | 'version' | 'createdAt' | 'updatedAt'
>;

export type CreatorAsset = {
  id: string;
  organizationId: string;
  productionId: string;
  generationJobId: string | null;
  storagePath: string;
  mediaType: 'image' | 'video' | 'audio';
  providerId: ProviderId | null;
  providerAssetId: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  provenance: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreatorReadinessResponse = {
  ok: true;
  service: string;
  version: string;
  organization_id: string;
  role: string;
  permissions: CreatorPermission[];
  providers: ProviderReadiness[];
  generation_enabled: boolean;
  checked_at: string;
};

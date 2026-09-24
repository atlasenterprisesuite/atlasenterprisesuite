import type { CameraSpec, ProductionSpec, SceneSpec, ShotSpec, SubjectSpec } from './types';

function emptyCamera(): CameraSpec {
  return {
    framing: '', angle: '', position: '', lens: '', focalLengthMm: null,
    depthOfField: '', movement: '', movementSpeed: '', focusTarget: '', orientationRule: ''
  };
}

export function createEmptyProductionSpec(options: {
  id?: string;
  organizationId?: string;
  createdByUserId?: string;
  now?: string;
} = {}): ProductionSpec {
  const timestamp = options.now ?? new Date().toISOString();
  return {
    id: options.id ?? crypto.randomUUID(),
    organizationId: options.organizationId ?? '',
    createdByUserId: options.createdByUserId ?? '',
    title: '',
    brief: '',
    status: 'draft',
    durationSeconds: 0,
    aspectRatio: 'adaptive',
    resolutionPreference: 'adaptive',
    audioEnabled: true,
    subjects: [],
    environment: {
      locationDescription: '', timeOfDay: '', lightingEnvironment: '',
      weatherOrAtmosphere: '', backgroundConstraints: [], referenceAssetIds: []
    },
    scenes: [],
    continuityRules: [],
    visualStyle: {
      photorealismLevel: '', cinematicStyle: '', textureStyle: '', colorPalette: '',
      contrastStyle: '', filmLook: '', grain: '', halation: '', surfaceDetail: '', lightingStyle: ''
    },
    cameraDefaults: emptyCamera(),
    motionRules: [],
    motionComposition: null,
    audioPlan: {
      musicDescription: '', ambientSound: '', soundEffects: [], dialogue: [],
      voiceReferenceAssetIds: [], syncRules: []
    },
    negativeConstraints: [],
    providerPreference: null,
    providerOverrides: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1
  };
}

export function createEmptyScene(options: { id?: string } = {}): SceneSpec {
  return {
    id: options.id ?? crypto.randomUUID(),
    title: '',
    startSecond: 0,
    endSecond: 0,
    description: '',
    shots: []
  };
}

export function createEmptyShot(options: { id?: string; order?: number } = {}): ShotSpec {
  return {
    id: options.id ?? crypto.randomUUID(),
    order: options.order ?? 0,
    title: '',
    startSecond: 0,
    endSecond: 0,
    subjectIds: [],
    action: '',
    camera: emptyCamera(),
    motion: { direction: '', speedProfile: '', physicality: '' },
    lighting: '',
    materials: [],
    audioCueIds: [],
    transitionIn: '',
    transitionOut: '',
    continuityNotes: [],
    negativeConstraints: []
  };
}

export function createEmptySubject(options: { id?: string } = {}): SubjectSpec {
  return {
    id: options.id ?? crypto.randomUUID(),
    label: '',
    description: '',
    identityLock: true,
    appearanceTraits: [],
    materialTraits: [],
    allowedTransformations: [],
    forbiddenChanges: [],
    referenceAssetIds: []
  };
}

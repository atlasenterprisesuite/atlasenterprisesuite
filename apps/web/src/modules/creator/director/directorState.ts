import type {
  ContinuityRule,
  NegativeConstraint,
  ProductionSpec,
  ProviderId,
  SceneSpec,
  ShotSpec,
  SubjectSpec
} from '../../../../../../packages/creator/types';

export type DirectorState = { spec: ProductionSpec; dirty: boolean };

type RootPatch = Partial<Pick<ProductionSpec,
  | 'title' | 'brief' | 'durationSeconds' | 'aspectRatio'
  | 'resolutionPreference' | 'audioEnabled' | 'environment'
  | 'visualStyle' | 'cameraDefaults' | 'motionRules' | 'audioPlan'
>>;

export type DirectorAction =
  | { type: 'root.patch'; patch: RootPatch }
  | { type: 'subject.add'; subject: SubjectSpec }
  | { type: 'subject.update'; subjectId: string; patch: Partial<SubjectSpec> }
  | { type: 'subject.remove'; subjectId: string }
  | { type: 'scene.add'; scene: SceneSpec }
  | { type: 'scene.update'; sceneId: string; patch: Partial<SceneSpec> }
  | { type: 'scene.remove'; sceneId: string }
  | { type: 'shot.add'; sceneId: string; shot: ShotSpec }
  | { type: 'shot.update'; sceneId: string; shotId: string; patch: Partial<ShotSpec> }
  | { type: 'shot.duplicate'; sceneId: string; shotId: string; shot: ShotSpec }
  | { type: 'shot.remove'; sceneId: string; shotId: string }
  | { type: 'shot.move'; sceneId: string; shotId: string; direction: 'up' | 'down' }
  | { type: 'continuity.add'; rule: ContinuityRule }
  | { type: 'continuity.update'; ruleId: string; patch: Partial<ContinuityRule> }
  | { type: 'continuity.remove'; ruleId: string }
  | { type: 'negative.add'; constraint: NegativeConstraint }
  | { type: 'negative.update'; constraintId: string; patch: Partial<NegativeConstraint> }
  | { type: 'negative.remove'; constraintId: string }
  | { type: 'provider.select'; providerId: ProviderId | null }
  | { type: 'save.succeeded'; spec: ProductionSpec };

export function createDirectorState(spec: ProductionSpec): DirectorState {
  return { spec, dirty: false };
}

export function isDirty(state: DirectorState) {
  return state.dirty;
}

function changed(state: DirectorState, spec: ProductionSpec): DirectorState {
  return { spec, dirty: true };
}

function mapScene(spec: ProductionSpec, sceneId: string, update: (scene: SceneSpec) => SceneSpec): ProductionSpec {
  return {
    ...spec,
    scenes: spec.scenes.map(scene => scene.id === sceneId ? update(scene) : scene)
  };
}

function normalizeShotOrder(shots: ShotSpec[]) {
  return shots.map((shot, index) => ({ ...shot, order: index + 1 }));
}

export function directorReducer(state: DirectorState, action: DirectorAction): DirectorState {
  const spec = state.spec;
  switch (action.type) {
    case 'root.patch':
      return changed(state, { ...spec, ...action.patch });
    case 'subject.add':
      return changed(state, { ...spec, subjects: [...spec.subjects, action.subject] });
    case 'subject.update':
      return changed(state, {
        ...spec,
        subjects: spec.subjects.map(subject => subject.id === action.subjectId ? { ...subject, ...action.patch } : subject)
      });
    case 'subject.remove':
      return changed(state, { ...spec, subjects: spec.subjects.filter(subject => subject.id !== action.subjectId) });
    case 'scene.add':
      return changed(state, { ...spec, scenes: [...spec.scenes, action.scene] });
    case 'scene.update':
      return changed(state, mapScene(spec, action.sceneId, scene => ({ ...scene, ...action.patch })));
    case 'scene.remove':
      return changed(state, { ...spec, scenes: spec.scenes.filter(scene => scene.id !== action.sceneId) });
    case 'shot.add':
      return changed(state, mapScene(spec, action.sceneId, scene => ({
        ...scene,
        shots: normalizeShotOrder([...scene.shots, action.shot])
      })));
    case 'shot.update':
      return changed(state, mapScene(spec, action.sceneId, scene => ({
        ...scene,
        shots: scene.shots.map(shot => shot.id === action.shotId ? { ...shot, ...action.patch } : shot)
      })));
    case 'shot.duplicate':
      return changed(state, mapScene(spec, action.sceneId, scene => {
        const index = scene.shots.findIndex(shot => shot.id === action.shotId);
        if (index < 0) return scene;
        const shots = [...scene.shots];
        shots.splice(index + 1, 0, action.shot);
        return { ...scene, shots: normalizeShotOrder(shots) };
      }));
    case 'shot.remove':
      return changed(state, mapScene(spec, action.sceneId, scene => ({
        ...scene,
        shots: normalizeShotOrder(scene.shots.filter(shot => shot.id !== action.shotId))
      })));
    case 'shot.move':
      return changed(state, mapScene(spec, action.sceneId, scene => {
        const index = scene.shots.findIndex(shot => shot.id === action.shotId);
        const neighbor = action.direction === 'up' ? index - 1 : index + 1;
        if (index < 0 || neighbor < 0 || neighbor >= scene.shots.length) return scene;
        const shots = [...scene.shots];
        [shots[index], shots[neighbor]] = [shots[neighbor], shots[index]];
        return { ...scene, shots: normalizeShotOrder(shots) };
      }));
    case 'continuity.add':
      return changed(state, { ...spec, continuityRules: [...spec.continuityRules, action.rule] });
    case 'continuity.update':
      return changed(state, {
        ...spec,
        continuityRules: spec.continuityRules.map(rule => rule.id === action.ruleId ? { ...rule, ...action.patch } : rule)
      });
    case 'continuity.remove':
      return changed(state, { ...spec, continuityRules: spec.continuityRules.filter(rule => rule.id !== action.ruleId) });
    case 'negative.add':
      return changed(state, { ...spec, negativeConstraints: [...spec.negativeConstraints, action.constraint] });
    case 'negative.update':
      return changed(state, {
        ...spec,
        negativeConstraints: spec.negativeConstraints.map(constraint => constraint.id === action.constraintId ? { ...constraint, ...action.patch } : constraint)
      });
    case 'negative.remove':
      return changed(state, { ...spec, negativeConstraints: spec.negativeConstraints.filter(constraint => constraint.id !== action.constraintId) });
    case 'provider.select':
      return changed(state, { ...spec, providerPreference: action.providerId });
    case 'save.succeeded':
      return {
        spec: {
          ...spec,
          ...action.spec,
          id: action.spec.id,
          version: action.spec.version,
          updatedAt: action.spec.updatedAt
        },
        dirty: false
      };
  }
}

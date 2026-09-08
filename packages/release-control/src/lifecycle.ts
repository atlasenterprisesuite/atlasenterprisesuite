import type { ReleaseLifecycleStatus } from './types';

const NEXT_STATUS: Readonly<Record<ReleaseLifecycleStatus, ReleaseLifecycleStatus | null>> = {
  developing: 'integrated',
  integrated: 'test_pending',
  test_pending: 'verified',
  verified: 'release_ready',
  release_ready: 'queued',
  queued: 'activating',
  activating: 'live',
  live: 'prod_verified',
  prod_verified: null,
};

export function canTransitionReleaseStatus(
  from: ReleaseLifecycleStatus,
  to: ReleaseLifecycleStatus,
): boolean {
  return NEXT_STATUS[from] === to;
}

export function unmetDependencies(
  dependencies: readonly string[],
  statuses: ReadonlyMap<string, ReleaseLifecycleStatus>,
  activatingTogether: ReadonlySet<string> = new Set<string>(),
): string[] {
  return dependencies.filter((dependency) => {
    if (activatingTogether.has(dependency)) return false;
    return statuses.get(dependency) !== 'prod_verified';
  });
}

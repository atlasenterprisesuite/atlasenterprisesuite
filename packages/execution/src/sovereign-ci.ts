export const SOVEREIGN_CI_REPOSITORY = 'atlasenterprisesuite/atlasenterprisesuite' as const;

export const SOVEREIGN_CI_COMMANDS = [
  { id: 'install_dependencies', command: 'npm', args: ['ci'] },
  { id: 'typecheck', command: 'npm', args: ['run', 'typecheck'] },
  { id: 'test', command: 'npm', args: ['test'] },
  { id: 'build', command: 'npm', args: ['run', 'build'] }
] as const;

export type SovereignCiCommandIdentifier = (typeof SOVEREIGN_CI_COMMANDS)[number]['id'];

export type SovereignCiCommandResult = {
  commandIdentifier: SovereignCiCommandIdentifier;
  exitCode: number;
};

export type SovereignCiFailureClass =
  | 'configuration_failure'
  | 'code_failure'
  | 'test_failure'
  | 'build_failure'
  | 'verification_failure';

export function normalizeSovereignCiRepository(value: unknown) {
  const repository = String(value ?? '').trim();
  if (!repository) throw new Error('repository_required');
  if (repository !== SOVEREIGN_CI_REPOSITORY) throw new Error('repository_not_allowed');
  return repository;
}

export function normalizeSovereignCiRef(value: unknown) {
  const requestedRef = String(value ?? '').trim();
  if (!requestedRef) throw new Error('requested_ref_required');
  if (
    requestedRef.length > 200 ||
    !/^[A-Za-z0-9._\/-]+$/.test(requestedRef) ||
    requestedRef.startsWith('/') ||
    requestedRef.endsWith('/') ||
    requestedRef.includes('..') ||
    requestedRef.includes('//') ||
    requestedRef.includes('@{') ||
    requestedRef.endsWith('.lock')
  ) throw new Error('invalid_requested_ref');
  return requestedRef;
}

function failureClassFor(command: SovereignCiCommandIdentifier): SovereignCiFailureClass {
  if (command === 'install_dependencies') return 'configuration_failure';
  if (command === 'typecheck') return 'code_failure';
  if (command === 'test') return 'test_failure';
  return 'build_failure';
}

export function evaluateSovereignCiGate(results: SovereignCiCommandResult[]) {
  const ids = SOVEREIGN_CI_COMMANDS.map((item) => item.id);
  for (const id of ids) {
    const matches = results.filter((result) => result.commandIdentifier === id);
    if (matches.length !== 1) {
      return {
        green: false as const,
        failureClass: 'verification_failure' as const,
        failedCommand: id
      };
    }
    if (!Number.isInteger(matches[0].exitCode) || matches[0].exitCode !== 0) {
      return {
        green: false as const,
        failureClass: failureClassFor(id),
        failedCommand: id
      };
    }
  }
  if (results.length !== ids.length) {
    const duplicate = results.find((result, index) =>
      results.findIndex((candidate) => candidate.commandIdentifier === result.commandIdentifier) !== index
    );
    return {
      green: false as const,
      failureClass: 'verification_failure' as const,
      failedCommand: duplicate?.commandIdentifier ?? 'build'
    };
  }
  return { green: true as const, failureClass: null, failedCommand: null };
}

export const SOVEREIGN_CI_STEPS = [
  { sequence: 1, actionType: 'resolve_target', evidenceKind: 'manager.ci.target' },
  { sequence: 2, actionType: 'acquire_source', evidenceKind: 'manager.ci.source' },
  { sequence: 3, actionType: 'install_dependencies', evidenceKind: 'manager.ci.install' },
  { sequence: 4, actionType: 'typecheck', evidenceKind: 'manager.ci.typecheck' },
  { sequence: 5, actionType: 'test', evidenceKind: 'manager.ci.test' },
  { sequence: 6, actionType: 'build', evidenceKind: 'manager.ci.build' },
  { sequence: 7, actionType: 'evaluate_gate', evidenceKind: 'manager.ci.gate' },
  { sequence: 8, actionType: 'finalize_evidence', evidenceKind: 'manager.ci.gate' }
] as const;

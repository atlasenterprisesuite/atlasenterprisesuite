import { describe, expect, it } from 'vitest';
import {
  SOVEREIGN_CI_COMMANDS,
  evaluateSovereignCiGate,
  normalizeSovereignCiRef,
  normalizeSovereignCiRepository
} from '../../packages/execution/src/sovereign-ci';

describe('ATLAS Manager Sovereign CI domain', () => {
  it('allows only the canonical repository in v1', () => {
    expect(normalizeSovereignCiRepository('atlasenterprisesuite/atlasenterprisesuite'))
      .toBe('atlasenterprisesuite/atlasenterprisesuite');
    expect(() => normalizeSovereignCiRepository('other/repo')).toThrow('repository_not_allowed');
    expect(() => normalizeSovereignCiRepository('')).toThrow('repository_required');
  });

  it('requires an explicit bounded branch, tag, or sha and never invents main', () => {
    expect(normalizeSovereignCiRef('feat/sovereign-ci')).toBe('feat/sovereign-ci');
    expect(normalizeSovereignCiRef('v1.2.3')).toBe('v1.2.3');
    expect(normalizeSovereignCiRef('0123456789abcdef0123456789abcdef01234567'))
      .toBe('0123456789abcdef0123456789abcdef01234567');
    expect(() => normalizeSovereignCiRef('')).toThrow('requested_ref_required');
    expect(() => normalizeSovereignCiRef('../main')).toThrow('invalid_requested_ref');
    expect(() => normalizeSovereignCiRef('refs/heads/main; rm -rf /')).toThrow('invalid_requested_ref');
  });

  it('exposes only the fixed npm verification command set', () => {
    expect(SOVEREIGN_CI_COMMANDS).toEqual([
      { id: 'install_dependencies', command: 'npm', args: ['ci'] },
      { id: 'typecheck', command: 'npm', args: ['run', 'typecheck'] },
      { id: 'test', command: 'npm', args: ['test'] },
      { id: 'build', command: 'npm', args: ['run', 'build'] }
    ]);
  });

  it('emits green only when every required command passes', () => {
    const green = evaluateSovereignCiGate([
      { commandIdentifier: 'install_dependencies', exitCode: 0 },
      { commandIdentifier: 'typecheck', exitCode: 0 },
      { commandIdentifier: 'test', exitCode: 0 },
      { commandIdentifier: 'build', exitCode: 0 }
    ]);
    expect(green).toEqual({ green: true, failureClass: null, failedCommand: null });

    const red = evaluateSovereignCiGate([
      { commandIdentifier: 'install_dependencies', exitCode: 0 },
      { commandIdentifier: 'typecheck', exitCode: 0 },
      { commandIdentifier: 'test', exitCode: 1 },
      { commandIdentifier: 'build', exitCode: 0 }
    ]);
    expect(red).toEqual({ green: false, failureClass: 'test_failure', failedCommand: 'test' });
  });

  it('fails closed when command evidence is missing or duplicated', () => {
    expect(evaluateSovereignCiGate([
      { commandIdentifier: 'install_dependencies', exitCode: 0 },
      { commandIdentifier: 'typecheck', exitCode: 0 },
      { commandIdentifier: 'test', exitCode: 0 }
    ])).toEqual({
      green: false,
      failureClass: 'verification_failure',
      failedCommand: 'build'
    });

    expect(evaluateSovereignCiGate([
      { commandIdentifier: 'install_dependencies', exitCode: 0 },
      { commandIdentifier: 'typecheck', exitCode: 0 },
      { commandIdentifier: 'test', exitCode: 0 },
      { commandIdentifier: 'test', exitCode: 0 },
      { commandIdentifier: 'build', exitCode: 0 }
    ])).toEqual({
      green: false,
      failureClass: 'verification_failure',
      failedCommand: 'test'
    });
  });
});

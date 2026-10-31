import { describe, expect, it } from 'vitest';

/**
 * ATLAS 777: deterministic reference-model tests, NOT PostgreSQL/RLS evidence.
 * The explicit linearization model defines the acceptance criterion for a future
 * two-connection database test. No production RPC is invoked here.
 */
type Event = 'authorize' | 'write' | 'commitWrite' | 'revoke' | 'commitRevoke';
type State = { active: boolean; pendingWrite: boolean; written: boolean; revoked: boolean };
function simulate(events: Event[]): State {
  const state: State = { active: true, pendingWrite: false, written: false, revoked: false };
  for (const event of events) {
    switch (event) {
      case 'authorize': state.pendingWrite = state.active; break;
      case 'write': break;
      case 'revoke': break;
      case 'commitRevoke': state.active = false; state.revoked = true; break;
      case 'commitWrite':
        // Authorization must be revalidated or serialized at the commit boundary.
        if (state.pendingWrite && state.active) state.written = true;
        state.pendingWrite = false;
        break;
    }
  }
  return state;
}

describe('ATLAS Advisory revocation linearization model (NOT database E2E)', () => {
  it('rejects a write that commits after a revocation commits', () => {
    expect(simulate(['authorize', 'write', 'revoke', 'commitRevoke', 'commitWrite']))
      .toMatchObject({ revoked: true, written: false });
  });
  it('permits a write serialized before revocation, but never after', () => {
    expect(simulate(['authorize', 'write', 'commitWrite', 'revoke', 'commitRevoke']))
      .toMatchObject({ revoked: true, written: true });
  });
  it('denies authorization after effective revocation', () => {
    expect(simulate(['revoke', 'commitRevoke', 'authorize', 'write', 'commitWrite']))
      .toMatchObject({ revoked: true, written: false });
  });
  it('documents why a single pre-write membership check is insufficient', () => {
    const vulnerable = (events: Event[]) => {
      let authorized = false, written = false;
      for (const e of events) {
        if (e === 'authorize') authorized = true;
        if (e === 'commitWrite' && authorized) written = true;
      }
      return written;
    };
    expect(vulnerable(['authorize', 'revoke', 'commitRevoke', 'commitWrite'])).toBe(true);
    expect(simulate(['authorize', 'revoke', 'commitRevoke', 'commitWrite']).written).toBe(false);
  });
});

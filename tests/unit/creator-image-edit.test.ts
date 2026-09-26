import { describe, expect, it } from 'vitest';
import {
  normalizeImageEditPoint,
  validateImageEditRequest,
  type ImageEditRequest
} from '../../packages/creator/image_edit';

describe('ATLAS Image Lab domain contract', () => {
  it('normalizes preview coordinates into stable 0..1 values', () => {
    expect(normalizeImageEditPoint(150, 75, 300, 150)).toEqual({ x: 0.5, y: 0.5 });
    expect(normalizeImageEditPoint(-10, 999, 300, 150)).toEqual({ x: 0, y: 1 });
  });

  it('accepts a valid identity-preserving edit request', () => {
    const request: ImageEditRequest = {
      globalInstruction: 'Remove the person on the right and keep both remaining faces unchanged.',
      preserveIdentity: true,
      aspectRatio: 'adaptive',
      visibility: 'private',
      points: [{ id: 'p1', x: 0.7, y: 0.4, instruction: 'Remove this person.' }]
    };
    expect(validateImageEditRequest(request)).toEqual({ ok: true });
  });

  it('rejects invalid coordinates and empty instructions', () => {
    expect(validateImageEditRequest({
      globalInstruction: '',
      preserveIdentity: true,
      aspectRatio: 'adaptive',
      visibility: 'private',
      points: [{ id: 'p1', x: 1.2, y: 0.4, instruction: '' }]
    })).toEqual({ ok: false, error: 'image_edit_instruction_required' });
  });
});

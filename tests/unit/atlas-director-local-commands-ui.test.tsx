import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyProductionSpec } from '../../packages/creator/defaults';
import { LocalDirectorCommands } from '../../apps/web/src/modules/creator/director/LocalDirectorCommands';

afterEach(cleanup);
describe('Local Director editor', () => {
  it('previews first and dispatches only on Apply', () => {
    const dispatch = vi.fn();
    render(<LocalDirectorCommands spec={createEmptyProductionSpec()} canWrite dispatch={dispatch} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Título: ATLAS' } });
    expect(screen.getByRole('status').textContent).toContain('Update title: ATLAS');
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Apply to draft/ }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'root.patch', patch: { title: 'ATLAS' } });
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('status').textContent).toContain('Save before rendering');
  });
  it('blocks editing without write permission', () => {
    const dispatch = vi.fn();
    render(<LocalDirectorCommands spec={createEmptyProductionSpec()} canWrite={false} dispatch={dispatch} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();
    fireEvent.click(screen.getByRole('button'));
    expect(dispatch).not.toHaveBeenCalled();
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkComposerPage } from '../../apps/web/src/work/WorkComposerPage';
import { createWorkWorkflow, listWorkflows } from '../../apps/web/src/work/api';

vi.mock('../../apps/web/src/work/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/work/api')>('../../apps/web/src/work/api');
  return { ...actual, createWorkWorkflow: vi.fn(), listWorkflows: vi.fn() };
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listWorkflows).mockResolvedValue([]);
});

describe('ATLAS Work composer launch flow', () => {
  it('previews before creating and then routes to canonical Guided Execution', async () => {
    vi.mocked(createWorkWorkflow).mockResolvedValue({ workflowId: 'wf-184', taskId: 'task-184' });

    render(
      <MemoryRouter initialEntries={['/work/new']}>
        <Routes>
          <Route path="/work/new" element={<WorkComposerPage />} />
          <Route path="/execution/:workflowId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('What do you want ATLAS to accomplish?'), {
      target: { value: 'Verify atlasenterprisesuite.com with OpenAI' }
    });
    fireEvent.change(screen.getByLabelText('Owner module'), { target: { value: 'manager' } });

    expect(createWorkWorkflow).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review plan' }));

    const previewHeading = screen.getByRole('heading', { name: 'Plan preview' });
    expect(previewHeading).toBeInTheDocument();
    const preview = previewHeading.closest('section');
    expect(preview).not.toBeNull();
    const scopedPreview = within(preview as HTMLElement);

    expect(scopedPreview.getByText('Hybrid')).toBeInTheDocument();
    expect(scopedPreview.getByText('Guided')).toBeInTheDocument();
    expect(scopedPreview.getByText('Auto')).toBeInTheDocument();
    expect(scopedPreview.getByText('$0')).toBeInTheDocument();
    expect(scopedPreview.getByText('DNS TXT exists')).toBeInTheDocument();
    expect(scopedPreview.getByText('public DNS returns the expected value')).toBeInTheDocument();
    expect(scopedPreview.getByText('OpenAI reports verified')).toBeInTheDocument();
    expect(createWorkWorkflow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Create workflow' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/execution/wf-184'));
    expect(createWorkWorkflow).toHaveBeenCalledTimes(1);
    expect(createWorkWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      intent: 'Verify atlasenterprisesuite.com with OpenAI',
      ownerModule: 'manager',
      executionMode: 'hybrid',
      autonomyLevel: 'guided',
      runtimePreference: 'auto',
      budgetLimit: 0
    }));
  });

  it('invalidates an existing preview when launch fields change', () => {
    render(
      <MemoryRouter>
        <WorkComposerPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('What do you want ATLAS to accomplish?'), {
      target: { value: 'Verify atlasenterprisesuite.com with OpenAI' }
    });
    fireEvent.change(screen.getByLabelText('Owner module'), { target: { value: 'manager' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review plan' }));
    expect(screen.getByRole('button', { name: 'Create workflow' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Autonomy'), { target: { value: 'manual' } });
    expect(screen.queryByRole('button', { name: 'Create workflow' })).not.toBeInTheDocument();
  });
});

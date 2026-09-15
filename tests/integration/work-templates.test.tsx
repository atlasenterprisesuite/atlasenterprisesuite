import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { WorkTemplatesPage } from '../../apps/web/src/work/WorkTemplatesPage';
import { createWorkTemplate } from '../../apps/web/src/work/api';

vi.mock('../../apps/web/src/work/api', async () => {
  const actual = await vi.importActual<typeof import('../../apps/web/src/work/api')>('../../apps/web/src/work/api');
  return { ...actual, createWorkTemplate: vi.fn() };
});

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

beforeEach(() => vi.clearAllMocks());

it('launches the real Manager OpenAI-domain template into canonical Guided Execution', async () => {
  vi.mocked(createWorkTemplate).mockResolvedValue({ workflowId: 'wf-domain', taskId: 'task-domain' });
  render(
    <MemoryRouter initialEntries={['/work/templates']}>
      <Routes>
        <Route path="/work/templates" element={<WorkTemplatesPage />} />
        <Route path="/execution/:workflowId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByText('ATLAS Manager')).toBeInTheDocument();
  expect(screen.getByText('Hybrid · Guided · $0')).toBeInTheDocument();
  const input = screen.getByLabelText('Domain');
  fireEvent.change(input, { target: { value: 'atlasenterprisesuite.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create verification workflow' }));

  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/execution/wf-domain'));
  expect(createWorkTemplate).toHaveBeenCalledWith('manager.openai_domain_verification', { domain: 'atlasenterprisesuite.com' });
});

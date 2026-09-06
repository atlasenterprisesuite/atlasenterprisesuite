// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { AtlasProvider, type AtlasIdentitySource, type AtlasIdentityState } from '../../apps/web/src/app/AtlasContext';
import { RecruitingRepositoryProvider } from '../../apps/web/src/modules/people/RecruitingDataProvider';
import { RecruitingWriteProvider } from '../../apps/web/src/modules/people/RecruitingWriteProvider';
import {
  PeopleRecruitingWriteService,
  type PeopleRecruitingWriteGateway,
  type RecruitingRepository,
} from '../../packages/people/src';

const repository: RecruitingRepository = {
  listRequisitions: async () => [{
    id: 'req-a', organizationId: 'org-a', title: 'Payroll Specialist', department: 'Finance', status: 'open',
    createdBy: 'user-a', createdAt: '2026-09-06T12:00:00Z', updatedAt: '2026-09-06T12:00:00Z',
  }],
  listCandidates: async () => [{
    id: 'candidate-a', organizationId: 'org-a', fullName: 'Ada Rivera', email: 'ada@example.com', phone: null,
    createdAt: '2026-09-06T12:00:00Z', updatedAt: '2026-09-06T12:00:00Z',
  }],
  listApplications: async () => [{
    id: 'app-a', organizationId: 'org-a', requisitionId: 'req-a', candidateId: 'candidate-a', stage: 'screening',
    decisionReason: null, createdAt: '2026-09-06T12:00:00Z', updatedAt: '2026-09-06T12:00:00Z',
  }],
  listAssessmentResults: async () => [{
    id: 'assessment-a', organizationId: 'org-a', applicationId: 'app-a', assessmentType: 'english', score: 84,
    maxScore: 100, result: { passed: true }, completedAt: '2026-09-06T12:30:00Z', createdAt: '2026-09-06T12:30:00Z',
  }],
};

function sourceFor(state: AtlasIdentityState): AtlasIdentitySource {
  return { resolve: async () => state };
}

function renderRecruiting(identity: AtlasIdentityState, service: PeopleRecruitingWriteService | null = null) {
  return render(
    <MemoryRouter initialEntries={['/people/recruiting']}>
      <AtlasProvider source={sourceFor(identity)}>
        <RecruitingRepositoryProvider repository={repository}>
          <RecruitingWriteProvider service={service}>
            <App />
          </RecruitingWriteProvider>
        </RecruitingRepositoryProvider>
      </AtlasProvider>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

it('renders persisted recruiting evidence for an HR reader', async () => {
  renderRecruiting({
    status: 'ready', userId: 'reader-a', organizationId: 'org-a', organizationName: 'Test Organization',
    role: 'manager', permissions: ['hr.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Recruiting' })).toBeInTheDocument();
  expect(screen.getByText('Ada Rivera')).toBeInTheDocument();
  expect(screen.getByText('Payroll Specialist')).toBeInTheDocument();
  expect(screen.getByText(/English · 84/)).toBeInTheDocument();
  expect(screen.getByLabelText('Candidate search')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Advance app-a to assessment' })).not.toBeInTheDocument();
});

it('advances an application only through the governed service with HR write', async () => {
  const advanceApplicationStage = vi.fn(async () => 'app-a');
  const gateway: PeopleRecruitingWriteGateway = {
    advanceApplicationStage,
    recordAssessmentResult: async () => 'assessment-a',
  };
  const service = new PeopleRecruitingWriteService(gateway);

  renderRecruiting({
    status: 'ready', userId: 'manager-a', organizationId: 'org-a', organizationName: 'Test Organization',
    role: 'manager', permissions: ['hr.read', 'hr.write'],
  }, service);

  await screen.findByRole('heading', { name: 'Recruiting' });
  fireEvent.click(screen.getByRole('button', { name: 'Advance app-a to assessment' }));

  await waitFor(() => expect(advanceApplicationStage).toHaveBeenCalledWith({
    organizationId: 'org-a',
    applicationId: 'app-a',
    currentStage: 'screening',
    nextStage: 'assessment',
    decisionReason: null,
  }));
  expect(await screen.findByText('Application moved to assessment')).toBeInTheDocument();
});

it('denies Recruiting without hr.read', async () => {
  renderRecruiting({
    status: 'ready', userId: 'viewer-a', organizationId: 'org-a', organizationName: 'Test Organization',
    role: 'viewer', permissions: ['payroll.read'],
  });

  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Recruiting' })).not.toBeInTheDocument();
});

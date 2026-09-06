import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type {
  AssessmentResultRecord,
  CandidateRecord,
  JobRequisitionRecord,
  RecruitingApplicationRecord,
  RecruitingRepository,
} from '../../../../../packages/people/src';
import { useAtlasContext } from '../../app/AtlasContext';

export type RecruitingDataState =
  | { status: 'waiting' }
  | { status: 'connection_unavailable' }
  | { status: 'loading' }
  | {
      status: 'ready';
      requisitions: JobRequisitionRecord[];
      candidates: CandidateRecord[];
      applications: RecruitingApplicationRecord[];
      assessments: AssessmentResultRecord[];
    }
  | { status: 'error'; message: string };

const RecruitingRepositoryContext = createContext<RecruitingRepository | null | undefined>(undefined);
const RecruitingRefreshContext = createContext({ version: 0, refresh: () => {} });

export function RecruitingRepositoryProvider({
  repository,
  children,
}: {
  repository: RecruitingRepository | null;
  children: ReactNode;
}) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  return (
    <RecruitingRepositoryContext.Provider value={repository}>
      <RecruitingRefreshContext.Provider value={{ version, refresh }}>
        {children}
      </RecruitingRefreshContext.Provider>
    </RecruitingRepositoryContext.Provider>
  );
}

export function useRecruitingRefresh() {
  return useContext(RecruitingRefreshContext).refresh;
}

export function useRecruitingData(): RecruitingDataState {
  const identity = useAtlasContext();
  const repository = useContext(RecruitingRepositoryContext) ?? null;
  const { version } = useContext(RecruitingRefreshContext);
  const [state, setState] = useState<RecruitingDataState>({ status: 'waiting' });

  useEffect(() => {
    let active = true;

    if (identity.status !== 'ready') {
      setState({ status: 'waiting' });
      return () => { active = false; };
    }
    if (!repository) {
      setState({ status: 'connection_unavailable' });
      return () => { active = false; };
    }

    setState({ status: 'loading' });
    void Promise.all([
      repository.listRequisitions(identity.organizationId),
      repository.listCandidates(identity.organizationId),
      repository.listApplications(identity.organizationId),
      repository.listAssessmentResults(identity.organizationId),
    ])
      .then(([requisitions, candidates, applications, assessments]) => {
        if (!active) return;
        setState({ status: 'ready', requisitions, candidates, applications, assessments });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Recruiting data could not be loaded.',
        });
      });

    return () => { active = false; };
  }, [identity, repository, version]);

  return state;
}

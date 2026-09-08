import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type {
  EmployeeRecord,
  PayrollLine,
  PayrollRun,
  PeopleRepository,
  TimeEntry,
} from '../../../../../packages/people/src';
import { useAtlasContext } from '../../app/AtlasContext';

export type PeopleTimeDataState =
  | { status: 'waiting' }
  | { status: 'connection_unavailable' }
  | { status: 'loading' }
  | { status: 'ready'; employees: EmployeeRecord[]; timeEntries: TimeEntry[] }
  | { status: 'error'; message: string };

export type PeoplePayrollDataState =
  | { status: 'waiting' }
  | { status: 'connection_unavailable' }
  | { status: 'loading' }
  | { status: 'ready'; employees: EmployeeRecord[]; payrollRuns: PayrollRun[]; payrollLines: PayrollLine[] }
  | { status: 'error'; message: string };

const PeopleRepositoryContext = createContext<PeopleRepository | null | undefined>(undefined);
const DEFAULT_REFRESH_CONTEXT: { version: number; refresh: () => void } = {
  version: 0,
  refresh: () => {},
};
const PeopleRefreshContext = createContext(DEFAULT_REFRESH_CONTEXT);

export function PeopleRepositoryProvider({
  repository,
  children,
}: {
  repository: PeopleRepository | null;
  children: ReactNode;
}) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  return (
    <PeopleRepositoryContext.Provider value={repository}>
      <PeopleRefreshContext.Provider value={{ version, refresh }}>
        {children}
      </PeopleRefreshContext.Provider>
    </PeopleRepositoryContext.Provider>
  );
}

export function usePeopleRepository(): PeopleRepository | null {
  return useContext(PeopleRepositoryContext) ?? null;
}

export function usePeopleRefresh(): () => void {
  return useContext(PeopleRefreshContext).refresh;
}

function usePeopleRefreshVersion(): number {
  return useContext(PeopleRefreshContext).version;
}

export function usePeopleTimeData(): PeopleTimeDataState {
  const identity = useAtlasContext();
  const repository = usePeopleRepository();
  const refreshVersion = usePeopleRefreshVersion();
  const [state, setState] = useState<PeopleTimeDataState>({ status: 'waiting' });

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
      repository.listEmployees(identity.organizationId),
      repository.listTimeEntries(identity.organizationId),
    ])
      .then(([employees, timeEntries]) => {
        if (!active) return;
        setState({ status: 'ready', employees, timeEntries });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'People data could not be loaded.',
        });
      });

    return () => { active = false; };
  }, [identity, repository, refreshVersion]);

  return state;
}

export function usePeoplePayrollData(): PeoplePayrollDataState {
  const identity = useAtlasContext();
  const repository = usePeopleRepository();
  const refreshVersion = usePeopleRefreshVersion();
  const [state, setState] = useState<PeoplePayrollDataState>({ status: 'waiting' });

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
      repository.listEmployees(identity.organizationId),
      repository.listPayrollRuns(identity.organizationId),
      repository.listPayrollLines(identity.organizationId),
    ])
      .then(([employees, payrollRuns, payrollLines]) => {
        if (!active) return;
        setState({ status: 'ready', employees, payrollRuns, payrollLines });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Payroll data could not be loaded.',
        });
      });

    return () => { active = false; };
  }, [identity, repository, refreshVersion]);

  return state;
}

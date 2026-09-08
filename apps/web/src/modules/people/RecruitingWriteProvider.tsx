import { createContext, useContext, type ReactNode } from 'react';
import type { PeopleRecruitingWriteService } from '../../../../../packages/people/src';

const RecruitingWriteContext = createContext<PeopleRecruitingWriteService | null | undefined>(undefined);

export function RecruitingWriteProvider({
  service,
  children,
}: {
  service: PeopleRecruitingWriteService | null;
  children: ReactNode;
}) {
  return (
    <RecruitingWriteContext.Provider value={service}>
      {children}
    </RecruitingWriteContext.Provider>
  );
}

export function useRecruitingWriteService(): PeopleRecruitingWriteService | null {
  return useContext(RecruitingWriteContext) ?? null;
}

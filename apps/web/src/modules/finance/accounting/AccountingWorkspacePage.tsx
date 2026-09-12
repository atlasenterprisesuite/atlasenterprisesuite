import { useState } from 'react';
import { AccountingActionPanel } from './AccountingActionPanel';
import {
  AccountingWorkspacePage as AccountingWorkspaceReadPage,
  type AccountingSection,
} from './AccountingWorkspaceReadPage';

export type { AccountingSection } from './AccountingWorkspaceReadPage';

export function AccountingWorkspacePage({ section }: { section: AccountingSection }) {
  const [version, setVersion] = useState(0);
  return (
    <>
      <AccountingWorkspaceReadPage key={`${section}-${version}`} section={section} />
      <AccountingActionPanel section={section} onChanged={() => setVersion((value) => value + 1)} />
    </>
  );
}

import { useState } from 'react';
import { PayablesApprovalPanel } from './PayablesApprovalPanel';
import { PayablesPage as PayablesReadPage } from './PayablesReadPage';

export function PayablesPage() {
  const [version, setVersion] = useState(0);
  return (
    <>
      <PayablesReadPage key={version} />
      <PayablesApprovalPanel onChanged={() => setVersion((value) => value + 1)} />
    </>
  );
}

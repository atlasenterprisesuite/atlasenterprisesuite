import { Link } from 'react-router-dom';
import type { GuidedWorkflow } from './types';

function safeReturnPath(workflow: GuidedWorkflow) {
  const candidate = workflow.context.return_path;
  return typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : '/';
}

export function ExecutionBreadcrumbs({ workflow }: { workflow: GuidedWorkflow }) {
  const returnPath = safeReturnPath(workflow);
  return (
    <nav className="execution-breadcrumbs" aria-label="Execution breadcrumbs">
      <Link to="/">Home</Link>
      <span aria-hidden="true">/</span>
      <span>{workflow.ownerModule || 'ATLAS'}</span>
      <span aria-hidden="true">/</span>
      <Link to={returnPath}>Return</Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">Execution</span>
    </nav>
  );
}

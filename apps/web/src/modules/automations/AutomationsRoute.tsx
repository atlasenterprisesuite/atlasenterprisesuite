import { hasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { AutomationsPage } from './AutomationsPage';

export function AutomationsRoute() {
  const identity = useAtlasContext();
  if (identity.status !== 'ready') return null;

  if (!hasPermission(identity.permissions, 'automation.read')) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">ATLAS Automations / Access</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">
          This organization identity does not have the required <code>automation.read</code> permission.
        </p>
      </main>
    );
  }

  return <AutomationsPage />;
}

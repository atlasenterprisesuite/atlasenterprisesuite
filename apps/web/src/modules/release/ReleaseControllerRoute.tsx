import { hasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { ReleaseControllerPage } from './ReleaseControllerPage';

export function ReleaseControllerRoute() {
  const identity = useAtlasContext();
  if (identity.status !== 'ready') return null;

  if (!hasPermission(identity.permissions, 'forge.release.read')) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">ATLAS Release / Access</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">
          This organization identity does not have the required <code>forge.release.read</code> permission.
        </p>
      </main>
    );
  }

  return <ReleaseControllerPage />;
}

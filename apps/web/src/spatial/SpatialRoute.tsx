import { hasPermission } from '../../../../packages/core/src';
import { useAtlasContext } from '../app/AtlasContext';
import { SpatialEntry } from './SpatialEntry';

export function SpatialRoute() {
  const identity = useAtlasContext();
  if (identity.status !== 'ready') return null;

  if (!hasPermission(identity.permissions, 'spatial.read')) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">ATLAS Spatial / Access</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">
          This organization identity does not have the required <code>spatial.read</code> permission.
        </p>
      </main>
    );
  }

  return <SpatialEntry />;
}

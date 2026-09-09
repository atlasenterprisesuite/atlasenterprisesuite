import { hasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { SiteReviewPage } from './SiteReviewPage';

export function SiteReviewRoute() {
  const identity = useAtlasContext();
  if (identity.status !== 'ready') return null;

  if (!hasPermission(identity.permissions, 'site-review.read')) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">ATLAS Site Review / Access</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">
          This organization identity does not have the required <code>site-review.read</code> permission.
        </p>
      </main>
    );
  }

  return <SiteReviewPage />;
}

import { hasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { RecruitingPage } from './RecruitingPage';

export function PeopleRecruitingRoute() {
  const identity = useAtlasContext();

  if (identity.status !== 'ready') return null;

  if (!hasPermission(identity.permissions, 'hr.read')) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">People / Recruiting / Access</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">
          This organization identity does not have the required <code>hr.read</code> permission.
        </p>
      </main>
    );
  }

  return <RecruitingPage />;
}

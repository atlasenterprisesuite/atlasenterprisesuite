import { hasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { MifiControlPage } from './MifiControlPage';

export function TelecomMifiRoute() {
  const identity = useAtlasContext();

  if (identity.status !== 'ready') {
    return null;
  }

  if (!hasPermission(identity.permissions, 'telecom.mifi.read')) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">Telecom / Access</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">
          This organization identity does not have the required <code>telecom.mifi.read</code> permission.
        </p>
      </main>
    );
  }

  return (
    <MifiControlPage
      writeAuthorized={hasPermission(identity.permissions, 'telecom.mifi.forwarding.write')}
    />
  );
}

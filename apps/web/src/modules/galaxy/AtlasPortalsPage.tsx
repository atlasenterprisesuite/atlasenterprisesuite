import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ATLAS_SESSION_EVENT,
  getCachedAtlasShellOrganization,
  type AtlasShellOrganization
} from '../../lib/atlasSession';
import { AtlasPortalDeck } from './AtlasPortalDeck';
import { ImmersivePortalPanel } from './ImmersivePortalPanel';
import { buildPortalDestinations, type PortalDestination } from './portalModel';

export function AtlasPortalsPage() {
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<AtlasShellOrganization | null>(
    () => getCachedAtlasShellOrganization()
  );
  const [selectedDestination, setSelectedDestination] = useState<PortalDestination | null>(null);

  useEffect(() => {
    const handleSessionChange = () => {
      setOrganization(getCachedAtlasShellOrganization());
    };

    window.addEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
    return () => window.removeEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
  }, []);

  const destinations = useMemo(
    () => buildPortalDestinations({ hasIdentity: Boolean(organization?.id) }),
    [organization?.id]
  );

  const handleEnter = (destination: PortalDestination) => {
    if (!destination.navigable) return;
    navigate(destination.route);
  };

  return (
    <section className="page-stack portals-page">
      <header className="page-header portal-page-header">
        <div>
          <p className="eyebrow">ATLAS Galaxy</p>
          <h1>ATLAS Portals</h1>
          <p>
            A futuristic spatial gateway to registered ATLAS destinations, using real routes and existing security boundaries.
          </p>
        </div>
        <Link className="portal-back-link" to="/galaxy">Back to Galaxy</Link>
      </header>

      {!organization ? (
        <div className="galaxy-resolution-state" role="status">
          Resolving ATLAS portal state
        </div>
      ) : (
        <>
          <AtlasPortalDeck
            destinations={destinations}
            onEnter={handleEnter}
            onSelectionChange={setSelectedDestination}
          />
          <ImmersivePortalPanel
            destination={selectedDestination}
            onTraverse={handleEnter}
          />
        </>
      )}
    </section>
  );
}

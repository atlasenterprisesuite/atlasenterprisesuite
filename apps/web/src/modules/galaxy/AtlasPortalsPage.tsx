import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ATLAS_SESSION_EVENT,
  getCachedAtlasShellOrganization,
  type AtlasShellOrganization
} from '../../lib/atlasSession';
import { AtlasPortalDeck } from './AtlasPortalDeck';
import { buildPortalDestinations, type PortalDestination } from './portalModel';

type PortalRuntimeMode = 'checking' | 'browser-3d' | 'webxr-capable';

type XRNavigator = Navigator & {
  xr?: {
    isSessionSupported: (mode: string) => Promise<boolean>;
  };
};

export function AtlasPortalsPage() {
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<AtlasShellOrganization | null>(
    () => getCachedAtlasShellOrganization()
  );
  const [runtimeMode, setRuntimeMode] = useState<PortalRuntimeMode>('checking');

  useEffect(() => {
    const handleSessionChange = () => {
      setOrganization(getCachedAtlasShellOrganization());
    };

    window.addEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
    return () => window.removeEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const xr = (navigator as XRNavigator).xr;

    if (!window.isSecureContext || !xr) {
      setRuntimeMode('browser-3d');
      return;
    }

    xr.isSessionSupported('immersive-ar')
      .then((supported) => {
        if (!cancelled) setRuntimeMode(supported ? 'webxr-capable' : 'browser-3d');
      })
      .catch(() => {
        if (!cancelled) setRuntimeMode('browser-3d');
      });

    return () => {
      cancelled = true;
    };
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

      <div className="portal-runtime" role="status">
        <span>Runtime</span>
        <strong>
          {runtimeMode === 'checking'
            ? 'Checking spatial capability'
            : runtimeMode === 'webxr-capable'
              ? 'Browser 3D · WebXR immersive AR capability detected'
              : 'Browser 3D'}
        </strong>
        <small>
          Immersive AR is reported only when the current secure browser exposes WebXR support. Portal navigation itself remains available in browser 3D.
        </small>
      </div>

      {!organization ? (
        <div className="galaxy-resolution-state" role="status">
          Resolving ATLAS portal state
        </div>
      ) : (
        <AtlasPortalDeck destinations={destinations} onEnter={handleEnter} />
      )}
    </section>
  );
}

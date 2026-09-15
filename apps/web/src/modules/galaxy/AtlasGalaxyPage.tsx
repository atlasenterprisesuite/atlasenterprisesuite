import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ATLAS_SESSION_EVENT,
  getCachedAtlasShellOrganization,
  type AtlasShellOrganization
} from '../../lib/atlasSession';
import { AtlasGalaxyMap } from './AtlasGalaxyMap';
import { buildGalaxyNodes, type GalaxyNodeView } from './galaxyModel';

export function AtlasGalaxyPage() {
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<AtlasShellOrganization | null>(
    () => getCachedAtlasShellOrganization()
  );

  useEffect(() => {
    const handleSessionChange = () => {
      setOrganization(getCachedAtlasShellOrganization());
    };

    window.addEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
    return () => window.removeEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
  }, []);

  const nodes = useMemo(
    () => buildGalaxyNodes({ hasIdentity: Boolean(organization?.id) }),
    [organization?.id]
  );

  const handleSelectNode = (node: GalaxyNodeView) => {
    if (!node.navigable || !node.route) return;
    navigate(node.route);
  };

  return (
    <section className="page-stack galaxy-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Platform</p>
        <h1>ATLAS Galaxy</h1>
        <p>Navigate the enterprise ecosystem through a truthful spatial view of registered modules and protected destinations.</p>
      </header>

      {!organization ? (
        <div className="galaxy-resolution-state" role="status">
          Resolving ATLAS module state
        </div>
      ) : (
        <AtlasGalaxyMap nodes={nodes} onSelectNode={handleSelectNode} />
      )}
    </section>
  );
}

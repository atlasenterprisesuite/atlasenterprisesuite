import { NavLink, useLocation } from 'react-router-dom';
import {
  ATLAS_AI_WORKSPACE_NAVIGATION,
  getAtlasAIWorkspaceNode
} from '../../navigation/atlasNavigation';
import './aiWorkspaceNav.css';

export function AIWorkspaceNav() {
  const location = useLocation();
  const activeNode = getAtlasAIWorkspaceNode(location.pathname);

  return (
    <nav className="atlas-ai-workspace-nav" aria-label="ATLAS AI workspace">
      <div className="atlas-ai-workspace-nav-track">
        {ATLAS_AI_WORKSPACE_NAVIGATION.map((node) => {
          const isActive = activeNode?.id === node.id;
          return (
            <NavLink
              key={node.id}
              to={node.to}
              data-atlas-ai-node={node.id}
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? 'atlas-ai-workspace-link is-active' : 'atlas-ai-workspace-link'}
            >
              <span>{node.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

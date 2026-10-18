import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react';
import {
  hydrateRuntimeReleaseMetadata,
  installRuntimeIntegrityListeners,
  recordRuntimeIncident
} from './runtimeIntegrity';

type BoundaryProps = { children: ReactNode };
type BoundaryState = { failed: boolean; incidentId: string | null };

class AtlasRuntimeErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false, incidentId: null };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true, incidentId: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const incident = recordRuntimeIncident({
      eventType: 'react-boundary',
      message: error.message || 'React render failure',
      stack: [error.stack, info.componentStack].filter(Boolean).join('\n')
    });

    this.setState({ incidentId: incident.id });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="atlas-runtime-fallback" role="alert">
        <div>
          <p className="eyebrow">ATLAS Runtime Integrity</p>
          <h1>Application rendering was contained</h1>
          <p>
            ATLAS prevented a component failure from becoming an unclassified blank screen. The browser-session
            incident was sanitized and recorded locally for diagnostics.
          </p>
          {this.state.incidentId ? <code>Incident {this.state.incidentId}</code> : null}
          <div className="atlas-runtime-fallback-actions">
            <button type="button" onClick={() => window.location.reload()}>Reload ATLAS</button>
            <a href="/cloud/runtime-integrity">Open Runtime Integrity</a>
          </div>
        </div>
      </main>
    );
  }
}

export function AtlasRuntimeIntegrityProvider({ children }: BoundaryProps) {
  useEffect(() => {
    const uninstall = installRuntimeIntegrityListeners();
    void hydrateRuntimeReleaseMetadata();
    return uninstall;
  }, []);

  return <AtlasRuntimeErrorBoundary>{children}</AtlasRuntimeErrorBoundary>;
}

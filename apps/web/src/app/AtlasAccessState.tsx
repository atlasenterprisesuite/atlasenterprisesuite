import type { AtlasIdentityState } from './AtlasContext';

export function AtlasAccessState({ state }: { state: Exclude<AtlasIdentityState, { status: 'ready' }> }) {
  if (state.status === 'loading') {
    return (
      <main className="atlas-page atlas-module-page">
        <h1>Loading ATLAS</h1>
        <p className="atlas-page__lede">Resolving the authenticated ATLAS identity and organization.</p>
      </main>
    );
  }

  if (state.status === 'configuration_required') {
    return (
      <main className="atlas-page atlas-module-page">
        <h1>ATLAS configuration required</h1>
        <p className="atlas-page__lede">
          Supabase runtime configuration is not available. Configure the publishable client URL and key before business routes can open.
        </p>
      </main>
    );
  }

  if (state.status === 'authentication_required') {
    return (
      <main className="atlas-page atlas-module-page">
        <h1>Authentication required</h1>
        <p className="atlas-page__lede">Sign in with an authorized ATLAS account to access organization data.</p>
      </main>
    );
  }

  if (state.status === 'organization_required') {
    return (
      <main className="atlas-page atlas-module-page">
        <h1>Organization required</h1>
        <p className="atlas-page__lede">The authenticated account has no active ATLAS organization membership.</p>
      </main>
    );
  }

  return (
    <main className="atlas-page atlas-module-page">
      <h1>ATLAS unavailable</h1>
      <p className="atlas-page__lede">{state.message}</p>
    </main>
  );
}

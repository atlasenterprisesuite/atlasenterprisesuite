import { Link } from 'react-router-dom';
import { listPublishDestinations } from '../../../../../packages/connect/destinations';

function capabilityLabel(capability: string): string {
  if (capability === 'manual_handoff') return 'Manual handoff';
  if (capability === 'provider_publish') return 'Provider publish';
  return 'Unavailable';
}

export function DestinationsPage() {
  const destinations = listPublishDestinations();

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect</p>
        <h1>Destinations</h1>
        <p>Capability is reported from the active destination contract, not inferred from configuration.</p>
      </header>
      <div className="destination-list">
        {destinations.map((destination) => (
          <Link
            key={destination.id}
            className="destination-card"
            to={destination.platform === 'whatsapp_channel' ? '/connect/destinations/whatsapp-channel' : '/connect/destinations'}
          >
            <div>
              <span className="eyebrow">{destination.platform.replaceAll('_', ' ')}</span>
              <h2>{destination.name}</h2>
              <p>{destination.capability === 'manual_handoff' ? 'Prepared content requires a human handoff and explicit confirmation.' : 'Provider capability is available.'}</p>
            </div>
            <span className="status-chip neutral">{capabilityLabel(destination.capability)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

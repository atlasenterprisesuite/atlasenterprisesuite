import { Link } from 'react-router-dom';
import { LocalDeviceModuleStatus } from '../device-os/LocalDeviceModuleStatus';

export function ConnectHomePage() {
  return (
    <section className="page-stack" aria-labelledby="atlas-connect-title">
      <header className="page-header">
        <p className="eyebrow">Communications</p>
        <h1 id="atlas-connect-title">ATLAS Connect</h1>
        <p>Governed communications and connectivity control plane. External capabilities remain fail-closed until ATLAS verifies an authorized integration path.</p>
      </header>

      <div className="module-grid">
        <Link className="module-card enabled" to="/connect/chat">
          <span>Messaging · Governed</span><strong>ATLAS Chat</strong>
          <p>Organization-scoped realtime messaging with durable history, ordered delivery, RBAC, audit and polling recovery.</p>
        </Link>
        <Link className="module-card enabled" to="/connect/channel">
          <span>Broadcast · Configured</span><strong>ATLAS Network</strong>
          <p>Official bilingual ATLAS broadcast feed with notifications, reactions and governed handoff to Social Publisher.</p>
        </Link>
        <Link className="module-card enabled" to="/connect/wireless">
          <span>Wireless · Pre-launch</span><strong>ATLAS Wireless</strong>
          <p>$39/month target architecture for unlimited mobile service, eSIM, ATLAS Home Hub and satellite fallback. Provider functions remain gated until verified.</p>
        </Link>
        <Link className="module-card enabled" to="/connect/google-fi">
          <span>Wireless · External-gated</span><strong>Google Fi Wireless</strong>
          <p>Official account portal and local statement staging without claiming unsupported private carrier APIs.</p>
        </Link>
      </div>

      <LocalDeviceModuleStatus moduleId="connect" title="Local communications devices" />
      <div className="notice">ATLAS Connect never represents a carrier, satellite or social provider as live unless an authorized, verifiable integration exists.</div>
    </section>
  );
}

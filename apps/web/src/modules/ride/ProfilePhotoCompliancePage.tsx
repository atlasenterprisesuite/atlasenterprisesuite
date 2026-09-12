import { RideSubnav } from './RideSubnav';

export function ProfilePhotoCompliancePage() {
  return (
    <section className="page-stack ride-page">
      <header className="page-header">
        <p className="eyebrow">Documents & Credentials</p>
        <h1>Profile Photo</h1>
        <p>Loading the authenticated profile-photo compliance requirement.</p>
      </header>
      <RideSubnav />
      <div className="identity-checking" role="status">
        <span className="pulse-dot" />
        <div>
          <strong>Loading compliance state</strong>
          <p>ATLAS is reading the current server state; no approval is inferred locally.</p>
        </div>
      </div>
    </section>
  );
}

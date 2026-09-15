import { Link } from 'react-router-dom';

export function InsuranceHome() {
  return (
    <section className="page-stack" aria-labelledby="atlas-insurance-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Insurance</p>
        <h1 id="atlas-insurance-title">Insurance Hub</h1>
        <p>Secure insurance access and governed member or policy verification inside your active ATLAS organization.</p>
      </header>

      <div className="module-grid">
        <Link className="module-card enabled" to="/insurance/verify?scope=insurance_access">
          <span>Secure access</span>
          <strong>Verify Insurance Access</strong>
          <p>Confirm your identity with the protected verification flow before sensitive insurance operations.</p>
        </Link>
        <div className="module-card disabled" aria-disabled="true">
          <span>Coverage data</span>
          <strong>No insurer data configured</strong>
          <p>Policies, members, eligibility and claims appear only after an authorized insurance data source is connected.</p>
        </div>
      </div>

      <div className="notice">
        ATLAS Insurance does not invent policy, member, claim, eligibility or premium data. Connected information is shown only after a real authorized source is available.
      </div>
    </section>
  );
}

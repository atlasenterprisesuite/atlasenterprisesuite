import { Link } from 'react-router-dom';
import { hasPermission } from '../../../../../packages/core/src';
import { useAtlasContext } from '../../app/AtlasContext';

export function PeopleHome() {
  const identity = useAtlasContext();
  if (identity.status !== 'ready') return null;

  const canSeeTime = ['hr.read', 'hr.write', 'payroll.self']
    .some((permission) => hasPermission(identity.permissions, permission));
  const canSeePayroll = hasPermission(identity.permissions, 'payroll.read');
  const canSeeRecruiting = hasPermission(identity.permissions, 'hr.read');
  const canSeeSelfService = hasPermission(identity.permissions, 'payroll.self');

  if (!canSeeTime && !canSeePayroll && !canSeeRecruiting && !canSeeSelfService) {
    return (
      <main className="atlas-page atlas-module-page">
        <p className="atlas-eyebrow">People / Access</p>
        <h1>Access denied</h1>
        <p className="atlas-page__lede">This organization identity does not have an authorized People Operations permission.</p>
      </main>
    );
  }

  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS People</p>
      <h1>People Operations</h1>
      <p className="atlas-page__lede">
        Governed employee, time, payroll, recruiting and self-service workflows scoped to the current organization and ATLAS identity permissions.
      </p>
      <div className="atlas-card-grid">
        {canSeeTime && (
          <Link className="atlas-module-card" to="/people/time">
            <strong>Time &amp; Attendance</strong>
            <span>View authorized time records and governed submission or approval actions.</span>
          </Link>
        )}
        {canSeePayroll && (
          <Link className="atlas-module-card" to="/people/payroll">
            <strong>Payroll</strong>
            <span>Review persisted payroll runs and lines with permission-gated lifecycle actions.</span>
          </Link>
        )}
        {canSeeRecruiting && (
          <Link className="atlas-module-card" to="/people/recruiting">
            <strong>Recruiting</strong>
            <span>Review requisitions, candidates, application stages and assessment evidence.</span>
          </Link>
        )}
        {canSeeSelfService && (
          <Link className="atlas-module-card" to="/people/self-service">
            <strong>Employee Self-Service</strong>
            <span>View your own profile, time, payroll, compensation and deduction records.</span>
          </Link>
        )}
      </div>
    </main>
  );
}

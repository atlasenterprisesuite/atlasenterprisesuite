import type { ComplianceRequirementStatus, ComplianceSubmissionStatus } from '../../../../../packages/compliance/types';

type Status = ComplianceRequirementStatus | ComplianceSubmissionStatus;

const labels: Record<Status, string> = {
  action_required: 'Action required',
  uploading: 'Uploading',
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  waived: 'Waived',
  superseded: 'Superseded'
};

export function ComplianceStatusBadge({ status }: { status: Status }) {
  return <span className={`ride-status ride-status-${status}`} data-status={status}>{labels[status]}</span>;
}

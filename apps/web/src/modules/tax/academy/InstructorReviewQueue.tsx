import { useEffect, useState } from 'react';
import { listAcademyReviewQueue, recordAcademyReviewerSignoff, type AcademyReviewQueueItem } from '../../../lib/taxAcademyApi';
import { RequireAcademyReviewer } from './AcademyAccess';

export function InstructorReviewQueue() {
  return (
    <RequireAcademyReviewer>
      <InstructorReviewQueueBody />
    </RequireAcademyReviewer>
  );
}

function InstructorReviewQueueBody() {
  const [items, setItems] = useState<AcademyReviewQueueItem[]>([]);
  const [message, setMessage] = useState('');

  const refresh = () => listAcademyReviewQueue().then(setItems).catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load review queue'));
  useEffect(() => { refresh(); }, []);

  const decide = async (item: AcademyReviewQueueItem, decision: 'approved' | 'remediate' | 'rejected') => {
    setMessage('');
    try {
      await recordAcademyReviewerSignoff({ userId: item.user_id, subjectType: 'attempt', subjectId: item.attempt_id, decision });
      setMessage(`Reviewer decision recorded: ${decision}`);
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to record reviewer decision');
    }
  };

  return (
    <div className="academy-page">
      <section className="academy-section-head"><div><p className="eyebrow">Instructor · tax.review</p><h1>Instructor Review Queue</h1><p>Reviewer-only practical signoff and remediation workflow.</p></div></section>
      {message ? <div className="academy-warning">{message}</div> : null}
      <section className="academy-review-list">
        {items.length === 0 ? <div className="academy-state-card">No submitted Academy attempts require review.</div> : items.map((item) => (
          <article key={item.attempt_id}>
            <div><small>{item.case_id} · {item.case_version}</small><strong>Candidate {item.user_id.slice(0, 8)}…</strong><span>Score: {item.weighted_score ?? 'pending'} · Critical failures: {item.critical_failure_codes.length}</span></div>
            <div className="academy-actions"><button onClick={() => decide(item, 'approved')}>Approve</button><button onClick={() => decide(item, 'remediate')}>Remediate</button><button onClick={() => decide(item, 'rejected')}>Reject</button></div>
          </article>
        ))}
      </section>
    </div>
  );
}

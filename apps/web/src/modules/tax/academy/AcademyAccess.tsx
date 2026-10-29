import { useEffect, useState, type ReactNode } from 'react';
import { hasAcademyPermission } from '../../../lib/taxAcademyApi';

export function RequireAcademyReviewer({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'allowed' | 'denied'>('loading');

  useEffect(() => {
    let active = true;
    hasAcademyPermission('tax.review')
      .then((allowed) => { if (active) setState(allowed ? 'allowed' : 'denied'); })
      .catch(() => { if (active) setState('denied'); });
    return () => { active = false; };
  }, []);

  if (state === 'loading') return <div className="academy-state-card">Verifying reviewer authorization…</div>;
  if (state === 'denied') return <div className="academy-state-card academy-state-danger"><strong>Access denied</strong><span>ATLAS permission tax.review is required.</span></div>;
  return <>{children}</>;
}

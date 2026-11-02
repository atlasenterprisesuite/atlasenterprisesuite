import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createAppFactoryPreview } from '../../../../packages/execution/src/app-factory-preview.mjs';

/**
 * Local concept preview only. No backend calls, no persistence, no deployment.
 * Tenant-scoped authenticated preview MUST be enabled through a server adapter
 * that calls createAuthorizedAppFactoryPreview with authoritative membership.
 */
export function AppFactoryPreviewPage() {
  const [idea, setIdea] = useState('');
  const [title, setTitle] = useState('New ATLAS application');
  const [requested, setRequested] = useState(false);
  const preview = useMemo(() => {
    if (!requested || !idea.trim()) return null;
    try {
      // Explicit non-identity placeholders: this result cannot be submitted
      // as an authorized proposal, nor used to persist or execute any action.
      return createAppFactoryPreview({
        idea,
        name: title,
        organizationId: 'local_preview_only',
        actorId: 'anonymous_preview'
      });
    } catch {
      return null;
    }
  }, [idea, title, requested]);
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <Link to="/work/os">Back to ATLAS Work</Link>
      <h1 className="text-2xl font-semibold">App Factory — concept preview</h1>
      <p>Local-only proposal. No AI generation, tenant authorization, code execution or deployment is enabled.</p>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setRequested(true); }}>
        <label className="block">Application name
          <input className="block w-full border p-2" maxLength={80} value={title} onChange={(event) => { setTitle(event.target.value); setRequested(false); }} required />
        </label>
        <label className="block">Describe the idea
          <textarea className="block w-full border p-2" maxLength={2000} value={idea} onChange={(event) => { setIdea(event.target.value); setRequested(false); }} required />
        </label>
        <button type="submit">Generate local concept preview</button>
      </form>
      {requested && !preview && <p role="alert">Please provide a valid application name and idea.</p>}
      {preview && <section aria-label="Generated concept preview" className="space-y-3">
        <h2 className="text-xl font-semibold">Proposed plan (not approved)</h2>
        <ol>{preview.plan.steps.map((step) => <li key={step.id}>{step.label}: pending</li>)}</ol>
        <iframe
          title="Isolated application concept preview"
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={preview.preview.html}
          className="h-80 w-full border"
        />
        <p role="status">This is a static concept only. Nothing has been saved or published.</p>
      </section>}
    </main>
  );
}

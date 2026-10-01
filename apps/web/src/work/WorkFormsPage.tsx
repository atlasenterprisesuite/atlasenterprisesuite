import { useEffect, useMemo, useState } from 'react';
import { ATLAS_MODULES } from '../modules/registry';
import {
  createWorkForm,
  listWorkForms,
  submitWorkForm,
  type WorkFormField,
  type WorkIntakeForm
} from './workOsAppsApi';
import { WorkSubnav } from './WorkSubnav';

const FIELD_TYPES: WorkFormField['type'][] = ['text', 'textarea', 'number', 'date', 'email', 'select'];

function newField(index: number): WorkFormField {
  return { id: 'field_' + index + '_' + crypto.randomUUID().slice(0, 8), label: 'Question ' + index, type: 'text', required: false };
}

export function WorkFormsPage() {
  const [forms, setForms] = useState<WorkIntakeForm[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerModule, setOwnerModule] = useState('work');
  const [fields, setFields] = useState<WorkFormField[]>([newField(1)]);
  const [activeFormId, setActiveFormId] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeForm = useMemo(() => forms.find(form => form.id === activeFormId) || forms[0] || null, [forms, activeFormId]);

  async function refresh() {
    setError('');
    try {
      const next = await listWorkForms();
      setForms(next);
      if (!activeFormId && next[0]) setActiveFormId(next[0].id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'work_forms_unavailable');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  function patchField(id: string, patch: Partial<WorkFormField>) {
    setFields(current => current.map(field => field.id === id ? { ...field, ...patch } : field));
  }

  async function saveForm() {
    if (saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await createWorkForm({ name, description, ownerModule, fields });
      setName('');
      setDescription('');
      setOwnerModule('work');
      setFields([newField(1)]);
      setMessage('Form saved in the active organization.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'work_form_save_failed');
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!activeForm || submitting) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await submitWorkForm(activeForm, answers);
      setAnswers({});
      setMessage('Submission recorded with organization scope and audit evidence.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'work_form_submission_failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="work-page page-stack">
      <WorkSubnav />
      <header className="page-header">
        <p className="eyebrow">ATLAS Work · Forms</p>
        <h1>Governed intake forms</h1>
        <p>Build structured organization forms without creating a separate workflow silo. Definitions and submissions use tenant-scoped persistence and audit controls.</p>
      </header>

      {error ? <div className="notice strong" role="alert">{error}</div> : null}
      {message ? <div className="notice" role="status">{message}</div> : null}

      <section className="execution-panel" aria-labelledby="work-form-builder-title">
        <div className="work-section-heading">
          <div><p className="eyebrow">Builder</p><h2 id="work-form-builder-title">Create form</h2></div>
        </div>
        <div className="work-config-grid">
          <label><span>Name</span><input value={name} maxLength={160} onChange={event => setName(event.target.value)} /></label>
          <label><span>Owner module</span><select value={ownerModule} onChange={event => setOwnerModule(event.target.value)}>
            <option value="work">Work</option>
            {ATLAS_MODULES.map(module => <option value={module.id} key={module.id}>{module.navLabel}</option>)}
          </select></label>
        </div>
        <label><span>Description</span><textarea rows={3} maxLength={1200} value={description} onChange={event => setDescription(event.target.value)} /></label>

        <div className="page-stack">
          {fields.map((field, index) => (
            <article className="module-card enabled" key={field.id}>
              <div className="work-config-grid">
                <label><span>Field label</span><input value={field.label} maxLength={160} onChange={event => patchField(field.id, { label: event.target.value })} /></label>
                <label><span>Type</span><select value={field.type} onChange={event => patchField(field.id, { type: event.target.value as WorkFormField['type'], options: event.target.value === 'select' ? field.options || [] : undefined })}>
                  {FIELD_TYPES.map(type => <option value={type} key={type}>{type}</option>)}
                </select></label>
                <label><span>Required</span><input type="checkbox" checked={field.required} onChange={event => patchField(field.id, { required: event.target.checked })} /></label>
              </div>
              {field.type === 'select' ? (
                <label><span>Options, one per line</span><textarea rows={3} value={(field.options || []).join('\n')} onChange={event => patchField(field.id, { options: event.target.value.split('\n').map(value => value.trim()).filter(Boolean).slice(0, 30) })} /></label>
              ) : null}
              <button type="button" className="module-experience-action secondary" disabled={fields.length === 1} onClick={() => setFields(current => current.filter(item => item.id !== field.id))}>Remove field {index + 1}</button>
            </article>
          ))}
        </div>

        <div className="atlas-action-row">
          <button type="button" className="module-experience-action secondary" onClick={() => setFields(current => [...current, newField(current.length + 1)])}>Add field</button>
          <button type="button" className="execution-action" disabled={saving || !name.trim() || fields.some(field => !field.label.trim())} onClick={() => void saveForm()}>{saving ? 'Saving…' : 'Save form'}</button>
        </div>
      </section>

      <section className="execution-panel" aria-labelledby="work-form-live-title">
        <div className="work-section-heading">
          <div><p className="eyebrow">{forms.length} saved</p><h2 id="work-form-live-title">Use a form</h2></div>
        </div>
        {loading ? <p aria-busy="true">Loading forms…</p> : null}
        {!loading && !forms.length ? <p className="muted">No forms exist yet.</p> : null}
        {forms.length ? (
          <>
            <label><span>Form</span><select value={activeForm?.id || ''} onChange={event => { setActiveFormId(event.target.value); setAnswers({}); }}>
              {forms.map(form => <option value={form.id} key={form.id}>{form.name}</option>)}
            </select></label>
            {activeForm ? (
              <div className="page-stack">
                <div><h3>{activeForm.name}</h3><p>{activeForm.description || 'No description.'}</p><small>Owner: {activeForm.owner_module}</small></div>
                {activeForm.fields.map(field => (
                  <label key={field.id}>
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                    {field.type === 'textarea' ? (
                      <textarea rows={4} value={answers[field.id] || ''} onChange={event => setAnswers(current => ({ ...current, [field.id]: event.target.value }))} />
                    ) : field.type === 'select' ? (
                      <select value={answers[field.id] || ''} onChange={event => setAnswers(current => ({ ...current, [field.id]: event.target.value }))}>
                        <option value="">Select…</option>
                        {(field.options || []).map(option => <option value={option} key={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input type={field.type} value={answers[field.id] || ''} onChange={event => setAnswers(current => ({ ...current, [field.id]: event.target.value }))} />
                    )}
                  </label>
                ))}
                <button type="button" className="execution-action" disabled={submitting} onClick={() => void submit()}>{submitting ? 'Submitting…' : 'Submit'}</button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </section>
  );
}

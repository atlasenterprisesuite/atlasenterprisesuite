import { FormEvent, useEffect, useMemo, useState } from 'react';
import { EVENT_STATUS_TRANSITIONS } from '../../../../../packages/events-entertainment/src';
import {
  createEventAssignment,
  createEventRecord,
  createEventTask,
  loadEventsWorkspace,
  transitionEventStatus,
  updateEventTaskStatus,
  type AtlasEventAssignment,
  type AtlasEventRecord,
  type AtlasEventTask
} from './eventsApi';

export function EventsOperationsPanel() {
  const [events, setEvents] = useState<AtlasEventRecord[]>([]);
  const [assignments, setAssignments] = useState<AtlasEventAssignment[]>([]);
  const [tasks, setTasks] = useState<AtlasEventTask[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh(preferredId?: string) {
    setError('');
    try {
      const data = await loadEventsWorkspace();
      setEvents(data.events); setAssignments(data.assignments); setTasks(data.tasks);
      const next = preferredId || selectedId || data.events[0]?.id || '';
      setSelectedId(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'events_workspace_unavailable');
    }
  }

  useEffect(() => { void refresh(); }, []);

  const selected = useMemo(() => events.find(event => event.id === selectedId) || null, [events, selectedId]);
  const selectedAssignments = assignments.filter(item => item.event_id === selectedId);
  const selectedTasks = tasks.filter(item => item.event_id === selectedId);

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const capacityRaw = String(form.get('capacity') || '').trim();
    setBusy(true); setError(''); setMessage('');
    try {
      const created = await createEventRecord({
        name: String(form.get('name') || ''),
        eventType: String(form.get('eventType') || 'general'),
        venueName: String(form.get('venue') || ''),
        startsAt: String(form.get('startsAt') || ''),
        endsAt: String(form.get('endsAt') || ''),
        capacity: capacityRaw ? Number(capacityRaw) : null,
        notes: String(form.get('notes') || '')
      });
      event.currentTarget.reset();
      setMessage('Event created inside the active ATLAS organization.');
      await refresh(created.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'event_create_failed'); }
    finally { setBusy(false); }
  }

  async function advance(status: AtlasEventRecord['status']) {
    if (!selected || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await transitionEventStatus(selected.id, status);
      setMessage('Event lifecycle transition recorded and audited.');
      await refresh(selected.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'event_transition_failed'); }
    finally { setBusy(false); }
  }

  async function addAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setMessage('');
    try {
      await createEventAssignment({
        eventId: selected.id,
        role: String(form.get('role') || 'staff'),
        displayName: String(form.get('displayName') || ''),
        contactReference: String(form.get('contactReference') || '')
      });
      event.currentTarget.reset();
      setMessage('Assignment added. This is an internal planning record, not an external booking confirmation.');
      await refresh(selected.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'event_assignment_failed'); }
    finally { setBusy(false); }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setMessage('');
    try {
      await createEventTask({
        eventId: selected.id,
        title: String(form.get('title') || ''),
        category: String(form.get('category') || 'production'),
        priority: String(form.get('priority') || 'normal'),
        ownerLabel: String(form.get('ownerLabel') || ''),
        dueAt: String(form.get('dueAt') || '')
      });
      event.currentTarget.reset();
      setMessage('Production task added.');
      await refresh(selected.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'event_task_failed'); }
    finally { setBusy(false); }
  }

  async function setTaskStatus(taskId: string, status: 'in_progress' | 'complete' | 'cancelled') {
    setBusy(true); setError(''); setMessage('');
    try { await updateEventTaskStatus(taskId, status); setMessage('Task state updated.'); await refresh(selectedId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'event_task_update_failed'); }
    finally { setBusy(false); }
  }

  const transitions = selected ? (EVENT_STATUS_TRANSITIONS[selected.status] || []) : [];

  return (
    <div className="page-stack">
      {error ? <div className="notice strong" role="alert">{error}</div> : null}
      {message ? <div className="notice" role="status">{message}</div> : null}

      <section className="execution-panel" aria-labelledby="event-create-title">
        <div className="work-section-heading"><div><p className="eyebrow">Operational core</p><h2 id="event-create-title">Create event</h2></div></div>
        <form className="page-stack" onSubmit={createEvent}>
          <div className="work-config-grid">
            <label><span>Name</span><input name="name" required maxLength={200} /></label>
            <label><span>Type</span><select name="eventType" defaultValue="general">{['general','concert','conference','festival','corporate','community','virtual'].map(value => <option value={value} key={value}>{value}</option>)}</select></label>
            <label><span>Venue / location label</span><input name="venue" maxLength={240} /></label>
            <label><span>Capacity</span><input name="capacity" type="number" min="0" /></label>
            <label><span>Starts</span><input name="startsAt" type="datetime-local" /></label>
            <label><span>Ends</span><input name="endsAt" type="datetime-local" /></label>
          </div>
          <label><span>Internal notes</span><textarea name="notes" rows={3} maxLength={5000} /></label>
          <button className="execution-action" type="submit" disabled={busy}>Create event</button>
        </form>
      </section>

      <section className="execution-panel" aria-labelledby="event-workspace-title">
        <div className="work-section-heading"><div><p className="eyebrow">{events.length} organization event{events.length === 1 ? '' : 's'}</p><h2 id="event-workspace-title">Event workspace</h2></div></div>
        {!events.length ? <p className="muted">No organization events exist yet.</p> : (
          <label><span>Event</span><select value={selectedId} onChange={event => setSelectedId(event.target.value)}>{events.map(item => <option value={item.id} key={item.id}>{item.name} · {item.status}</option>)}</select></label>
        )}
        {selected ? (
          <div className="page-stack">
            <div className="metric-grid">
              <article><span>Status</span><strong>{selected.status}</strong></article>
              <article><span>Type</span><strong>{selected.event_type}</strong></article>
              <article><span>Capacity</span><strong>{selected.capacity ?? '—'}</strong></article>
              <article><span>Tasks open</span><strong>{selectedTasks.filter(task => !['complete','cancelled'].includes(task.status)).length}</strong></article>
            </div>
            <div className="notice">
              {selected.venue_name || 'Location not set'} · {selected.starts_at ? new Date(selected.starts_at).toLocaleString() : 'start not set'} → {selected.ends_at ? new Date(selected.ends_at).toLocaleString() : 'end not set'}
            </div>
            <div className="atlas-action-row">
              {transitions.map(status => <button type="button" className="module-experience-action" key={status} disabled={busy} onClick={() => void advance(status as AtlasEventRecord['status'])}>{status}</button>)}
            </div>
          </div>
        ) : null}
      </section>

      {selected ? (
        <>
          <section className="execution-panel">
            <h2>Talent, venue, vendor & staff assignments</h2>
            <p className="notice">An assignment is an ATLAS planning fact. External artist booking remains authorization-required until a verified booking provider is connected.</p>
            <form className="work-config-grid" onSubmit={addAssignment}>
              <label><span>Role</span><select name="role" defaultValue="staff">{['producer','artist','performer','venue','staff','vendor','sponsor'].map(value => <option value={value} key={value}>{value}</option>)}</select></label>
              <label><span>Name</span><input name="displayName" required /></label>
              <label><span>Contact reference</span><input name="contactReference" placeholder="Internal ref, email or provider ref" /></label>
              <button className="execution-action" type="submit" disabled={busy}>Add assignment</button>
            </form>
            <div className="module-experience-grid">{selectedAssignments.map(item => <article className="module-experience-card is-active" key={item.id}><span className="module-experience-card-label">{item.role} · {item.status}</span><strong>{item.display_name}</strong><p>{item.contact_reference || 'No contact reference'}</p></article>)}</div>
          </section>

          <section className="execution-panel">
            <h2>Production tasks</h2>
            <form className="work-config-grid" onSubmit={addTask}>
              <label><span>Task</span><input name="title" required /></label>
              <label><span>Category</span><select name="category" defaultValue="production">{['production','venue','talent','marketing','safety','logistics','settlement'].map(value => <option value={value} key={value}>{value}</option>)}</select></label>
              <label><span>Priority</span><select name="priority" defaultValue="normal">{['low','normal','high','critical'].map(value => <option value={value} key={value}>{value}</option>)}</select></label>
              <label><span>Owner</span><input name="ownerLabel" /></label>
              <label><span>Due</span><input name="dueAt" type="datetime-local" /></label>
              <button className="execution-action" type="submit" disabled={busy}>Add task</button>
            </form>
            <div className="module-experience-grid">{selectedTasks.map(task => <article className="module-experience-card is-active" key={task.id}><span className="module-experience-card-label">{task.category} · {task.priority}</span><strong>{task.title}</strong><p>{task.status} · {task.owner_label || 'unassigned'}{task.due_at ? ' · ' + new Date(task.due_at).toLocaleString() : ''}</p><div className="atlas-action-row">{task.status === 'open' ? <button type="button" disabled={busy} onClick={() => void setTaskStatus(task.id,'in_progress')}>Start</button> : null}{!['complete','cancelled'].includes(task.status) ? <button type="button" disabled={busy} onClick={() => void setTaskStatus(task.id,'complete')}>Complete</button> : null}</div></article>)}</div>
          </section>
        </>
      ) : null}
    </div>
  );
}

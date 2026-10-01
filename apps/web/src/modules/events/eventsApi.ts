import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type AtlasEventRecord = {
  id: string;
  org_id: string;
  name: string;
  event_type: string;
  status: 'draft' | 'planning' | 'on_sale' | 'live' | 'settling' | 'closed' | 'cancelled';
  venue_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  capacity: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type AtlasEventAssignment = {
  id: string;
  event_id: string;
  role: string;
  display_name: string;
  contact_reference: string | null;
  status: string;
};

export type AtlasEventTask = {
  id: string;
  event_id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  owner_label: string | null;
  blocker: string | null;
  due_at: string | null;
  completed_at: string | null;
};

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: 'invalid_response' }; }
  if (!response.ok) throw new Error(String(body?.message || body?.error || `events_request_failed_${response.status}`));
  return body as T;
}

const headers = { 'content-type': 'application/json', prefer: 'return=representation' };

export async function loadEventsWorkspace() {
  const org = await getActiveAtlasOrganization();
  const make = (table: string, select: string, order: string) => {
    const params = new URLSearchParams({ select, org_id: `eq.${org.id}`, order });
    return authorizedAtlasFetch(`/rest/v1/${table}?${params.toString()}`, { method: 'GET' });
  };
  const [eventsRes, assignmentsRes, tasksRes] = await Promise.all([
    make('event_records', 'id,org_id,name,event_type,status,venue_name,starts_at,ends_at,capacity,notes,created_at,updated_at', 'starts_at.asc.nullslast,created_at.desc'),
    make('event_assignments', 'id,event_id,role,display_name,contact_reference,status', 'created_at.asc'),
    make('event_tasks', 'id,event_id,title,category,status,priority,owner_label,blocker,due_at,completed_at', 'created_at.asc')
  ]);
  return {
    events: await parse<AtlasEventRecord[]>(eventsRes),
    assignments: await parse<AtlasEventAssignment[]>(assignmentsRes),
    tasks: await parse<AtlasEventTask[]>(tasksRes)
  };
}

export async function createEventRecord(input: {
  name: string;
  eventType: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  notes: string;
}) {
  const org = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/event_records?select=id,org_id,name,event_type,status,venue_name,starts_at,ends_at,capacity,notes,created_at,updated_at', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      org_id: org.id,
      name: input.name.trim(),
      event_type: input.eventType,
      venue_name: input.venueName.trim() || null,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      capacity: input.capacity,
      notes: input.notes.trim()
    })
  });
  const rows = await parse<AtlasEventRecord[]>(response);
  if (!rows?.[0]) throw new Error('event_create_failed');
  return rows[0];
}

export async function transitionEventStatus(eventId: string, status: AtlasEventRecord['status']) {
  const org = await getActiveAtlasOrganization();
  const params = new URLSearchParams({ id: `eq.${eventId}`, org_id: `eq.${org.id}`, select: 'id,org_id,name,event_type,status,venue_name,starts_at,ends_at,capacity,notes,created_at,updated_at' });
  const response = await authorizedAtlasFetch(`/rest/v1/event_records?${params.toString()}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status })
  });
  const rows = await parse<AtlasEventRecord[]>(response);
  if (!rows?.[0]) throw new Error('event_transition_failed');
  return rows[0];
}

export async function createEventAssignment(input: { eventId: string; role: string; displayName: string; contactReference?: string }) {
  const org = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/event_assignments?select=id,event_id,role,display_name,contact_reference,status', {
    method: 'POST',
    headers,
    body: JSON.stringify({ org_id: org.id, event_id: input.eventId, role: input.role, display_name: input.displayName.trim(), contact_reference: input.contactReference?.trim() || null })
  });
  const rows = await parse<AtlasEventAssignment[]>(response);
  if (!rows?.[0]) throw new Error('event_assignment_create_failed');
  return rows[0];
}

export async function createEventTask(input: { eventId: string; title: string; category: string; priority: string; ownerLabel?: string; dueAt?: string }) {
  const org = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/event_tasks?select=id,event_id,title,category,status,priority,owner_label,blocker,due_at,completed_at', {
    method: 'POST',
    headers,
    body: JSON.stringify({ org_id: org.id, event_id: input.eventId, title: input.title.trim(), category: input.category, priority: input.priority, owner_label: input.ownerLabel?.trim() || null, due_at: input.dueAt || null })
  });
  const rows = await parse<AtlasEventTask[]>(response);
  if (!rows?.[0]) throw new Error('event_task_create_failed');
  return rows[0];
}

export async function updateEventTaskStatus(taskId: string, status: 'open' | 'in_progress' | 'blocked' | 'complete' | 'cancelled', blocker = '') {
  const org = await getActiveAtlasOrganization();
  const params = new URLSearchParams({ id: `eq.${taskId}`, org_id: `eq.${org.id}`, select: 'id,event_id,title,category,status,priority,owner_label,blocker,due_at,completed_at' });
  const response = await authorizedAtlasFetch(`/rest/v1/event_tasks?${params.toString()}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status, blocker: blocker.trim() || null, completed_at: status === 'complete' ? new Date().toISOString() : null })
  });
  const rows = await parse<AtlasEventTask[]>(response);
  if (!rows?.[0]) throw new Error('event_task_update_failed');
  return rows[0];
}

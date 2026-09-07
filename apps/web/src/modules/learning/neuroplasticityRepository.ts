import type { NeuroplasticityProfile } from '../../../../../packages/learning/neuroplasticity';

export interface StoredNeuroplasticityProgram {
  profile: NeuroplasticityProfile;
  completedIds: string[];
  startDate: string;
}

export type PersistenceState =
  | { status: 'ready'; userId: string; orgId: string }
  | { status: 'unconfigured' }
  | { status: 'signed-out' };

type SupabaseSession = { access_token?: string };

type ProgramRow = {
  goal: NeuroplasticityProfile['goal'];
  minutes_per_day: number;
  experience_level: NeuroplasticityProfile['experienceLevel'];
  sleep_hours: number | string;
  exercise_days_per_week: number;
  professional_review_recommended: boolean;
  completed_activity_ids: string[];
  program_start_date: string;
};

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function decodeSession(raw: string): SupabaseSession | null {
  try {
    const value = raw.startsWith('base64-') ? atob(raw.slice(7)) : raw;
    return JSON.parse(value) as SupabaseSession;
  } catch {
    return null;
  }
}

function accessToken(): string | null {
  if (!url) return null;
  const projectRef = new URL(url).hostname.split('.')[0];
  const session = decodeSession(window.localStorage.getItem(`sb-${projectRef}-auth-token`) ?? '');
  return session?.access_token ?? null;
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: publishableKey!,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function resolvePersistence(): Promise<PersistenceState> {
  if (!url || !publishableKey) return { status: 'unconfigured' };
  const token = accessToken();
  if (!token) return { status: 'signed-out' };

  const user = await request<{ id: string }>('/auth/v1/user', token);
  const memberships = await request<Array<{ org_id: string }>>(
    `/rest/v1/organization_members?select=org_id&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`,
    token
  );
  if (!memberships[0]) throw new Error('No active ATLAS organization membership was found.');
  return { status: 'ready', userId: user.id, orgId: memberships[0].org_id };
}

export async function loadProgram(context: Extract<PersistenceState, { status: 'ready' }>): Promise<StoredNeuroplasticityProgram | null> {
  const token = accessToken();
  if (!token) return null;
  const rows = await request<ProgramRow[]>(
    `/rest/v1/atlas_neuroplasticity_programs?select=goal,minutes_per_day,experience_level,sleep_hours,exercise_days_per_week,professional_review_recommended,completed_activity_ids,program_start_date&org_id=eq.${context.orgId}&user_id=eq.${context.userId}&limit=1`,
    token
  );
  const row = rows[0];
  if (!row) return null;
  return {
    profile: {
      goal: row.goal,
      minutesPerDay: row.minutes_per_day,
      experienceLevel: row.experience_level,
      sleepHours: Number(row.sleep_hours),
      exerciseDaysPerWeek: row.exercise_days_per_week,
      hasNeurologicalCondition: row.professional_review_recommended
    },
    completedIds: row.completed_activity_ids,
    startDate: row.program_start_date
  };
}

export async function saveProgram(
  context: Extract<PersistenceState, { status: 'ready' }>,
  program: StoredNeuroplasticityProgram
): Promise<void> {
  const token = accessToken();
  if (!token) throw new Error('Sign in is required.');
  await request('/rest/v1/atlas_neuroplasticity_programs?on_conflict=org_id,user_id', token, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      org_id: context.orgId,
      user_id: context.userId,
      goal: program.profile.goal,
      minutes_per_day: program.profile.minutesPerDay,
      experience_level: program.profile.experienceLevel,
      sleep_hours: program.profile.sleepHours,
      exercise_days_per_week: program.profile.exerciseDaysPerWeek,
      professional_review_recommended: program.profile.hasNeurologicalCondition,
      completed_activity_ids: program.completedIds,
      program_start_date: program.startDate,
      plan_version: 'v1',
      updated_at: new Date().toISOString()
    })
  });
}

export async function deleteProgram(context: Extract<PersistenceState, { status: 'ready' }>): Promise<void> {
  const token = accessToken();
  if (!token) throw new Error('Sign in is required.');
  await request(
    `/rest/v1/atlas_neuroplasticity_programs?org_id=eq.${context.orgId}&user_id=eq.${context.userId}`,
    token,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
  );
}

import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../lib/atlasSession';

export type WorkFormField = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'email' | 'select';
  required: boolean;
  options?: string[];
};

export type WorkIntakeForm = {
  id: string;
  org_id: string;
  name: string;
  description: string;
  owner_module: string;
  fields: WorkFormField[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkFormSubmission = {
  id: string;
  form_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type AtlasDriveFile = {
  id: string;
  org_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string | null;
  created_at: string;
};

function jsonHeaders() {
  return { 'content-type': 'application/json', prefer: 'return=representation' };
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: 'invalid_response' }; }
  if (!response.ok) throw new Error(String(body?.message || body?.error || `work_os_request_failed_${response.status}`));
  return body as T;
}

function normalizeFields(value: unknown): WorkFormField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((field: any) => {
    const type = String(field?.type || 'text');
    if (!['text', 'textarea', 'number', 'date', 'email', 'select'].includes(type)) return [];
    const id = String(field?.id || '').trim();
    const label = String(field?.label || '').trim();
    if (!id || !label) return [];
    return [{
      id,
      label,
      type: type as WorkFormField['type'],
      required: field?.required === true,
      ...(type === 'select' ? { options: Array.isArray(field?.options) ? field.options.map(String).map((item: string) => item.trim()).filter(Boolean).slice(0, 30) : [] } : {})
    }];
  }).slice(0, 40);
}

export async function listWorkForms(): Promise<WorkIntakeForm[]> {
  const organization = await getActiveAtlasOrganization();
  const params = new URLSearchParams({
    select: 'id,org_id,name,description,owner_module,fields,active,created_at,updated_at',
    org_id: `eq.${organization.id}`,
    order: 'updated_at.desc'
  });
  const response = await authorizedAtlasFetch(`/rest/v1/work_intake_forms?${params.toString()}`, { method: 'GET' });
  const rows = await parseJson<any[]>(response);
  return (Array.isArray(rows) ? rows : []).map(row => ({ ...row, fields: normalizeFields(row.fields) })) as WorkIntakeForm[];
}

export async function createWorkForm(input: {
  name: string;
  description: string;
  ownerModule: string;
  fields: WorkFormField[];
}): Promise<WorkIntakeForm> {
  const organization = await getActiveAtlasOrganization();
  const fields = normalizeFields(input.fields);
  if (!input.name.trim() || !fields.length) throw new Error('work_form_name_and_fields_required');
  const response = await authorizedAtlasFetch('/rest/v1/work_intake_forms?select=id,org_id,name,description,owner_module,fields,active,created_at,updated_at', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      org_id: organization.id,
      name: input.name.trim(),
      description: input.description.trim(),
      owner_module: input.ownerModule.trim() || 'work',
      fields
    })
  });
  const rows = await parseJson<any[]>(response);
  if (!rows?.[0]) throw new Error('work_form_persistence_failed');
  return { ...rows[0], fields: normalizeFields(rows[0].fields) } as WorkIntakeForm;
}

export async function submitWorkForm(form: WorkIntakeForm, payload: Record<string, unknown>): Promise<WorkFormSubmission> {
  const organization = await getActiveAtlasOrganization();
  if (form.org_id !== organization.id || !form.active) throw new Error('work_form_scope_invalid');
  const normalized: Record<string, unknown> = {};
  for (const field of form.fields) {
    const raw = payload[field.id];
    const value = raw === undefined || raw === null ? '' : String(raw).trim();
    if (field.required && !value) throw new Error(`work_form_required_${field.id}`);
    if (field.type === 'number' && value) {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) throw new Error(`work_form_invalid_number_${field.id}`);
      normalized[field.id] = numberValue;
    } else if (field.type === 'select' && value) {
      if (!(field.options || []).includes(value)) throw new Error(`work_form_invalid_option_${field.id}`);
      normalized[field.id] = value;
    } else {
      normalized[field.id] = value;
    }
  }
  const response = await authorizedAtlasFetch('/rest/v1/work_form_submissions?select=id,form_id,payload,created_at', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ org_id: organization.id, form_id: form.id, payload: normalized })
  });
  const rows = await parseJson<WorkFormSubmission[]>(response);
  if (!rows?.[0]) throw new Error('work_form_submission_failed');
  return rows[0];
}

function safeFileName(value: string) {
  const cleaned = value.normalize('NFKC').replace(/[\\/\0-\x1f\x7f]+/g, '-').replace(/\s+/g, ' ').trim();
  return (cleaned || 'file').slice(0, 180);
}

function encodeStoragePath(path: string) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export async function listDriveFiles(): Promise<AtlasDriveFile[]> {
  const organization = await getActiveAtlasOrganization();
  const params = new URLSearchParams({
    select: 'id,org_id,storage_path,file_name,mime_type,size_bytes,sha256,created_at',
    org_id: `eq.${organization.id}`,
    order: 'created_at.desc'
  });
  const response = await authorizedAtlasFetch(`/rest/v1/atlas_drive_files?${params.toString()}`, { method: 'GET' });
  const rows = await parseJson<any[]>(response);
  return (Array.isArray(rows) ? rows : []).map(row => ({ ...row, size_bytes: Number(row.size_bytes || 0) })) as AtlasDriveFile[];
}

export async function uploadDriveFile(file: File): Promise<AtlasDriveFile> {
  if (!file.size || file.size > 26_214_400) throw new Error('drive_file_size_invalid');
  const organization = await getActiveAtlasOrganization();
  const fileName = safeFileName(file.name);
  const storagePath = `${organization.id}/${crypto.randomUUID()}-${fileName}`;
  const endpoint = `/storage/v1/object/atlas-drive/${encodeStoragePath(storagePath)}`;
  const upload = await authorizedAtlasFetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream', 'x-upsert': 'false', 'cache-control': 'no-store' },
    body: file
  });
  if (!upload.ok) throw new Error(`drive_upload_failed_${upload.status}`);

  try {
    const digest = await sha256(file);
    const metadata = await authorizedAtlasFetch('/rest/v1/atlas_drive_files?select=id,org_id,storage_path,file_name,mime_type,size_bytes,sha256,created_at', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        org_id: organization.id,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        sha256: digest,
        provenance: { source: 'atlas-drive-browser-upload', sha256_verified_client_side: true }
      })
    });
    const rows = await parseJson<any[]>(metadata);
    if (!rows?.[0]) throw new Error('drive_metadata_failed');
    return { ...rows[0], size_bytes: Number(rows[0].size_bytes || 0) } as AtlasDriveFile;
  } catch (error) {
    await authorizedAtlasFetch('/storage/v1/object/atlas-drive', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: [storagePath] })
    }).catch(() => null);
    throw error;
  }
}

export async function downloadDriveFile(file: AtlasDriveFile): Promise<Blob> {
  const response = await authorizedAtlasFetch(`/storage/v1/object/authenticated/atlas-drive/${encodeStoragePath(file.storage_path)}`, { method: 'GET' });
  if (!response.ok) throw new Error(`drive_download_failed_${response.status}`);
  return response.blob();
}

export async function deleteDriveFile(file: AtlasDriveFile) {
  const storage = await authorizedAtlasFetch('/storage/v1/object/atlas-drive', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: [file.storage_path] })
  });
  if (!storage.ok) throw new Error(`drive_delete_failed_${storage.status}`);
  const organization = await getActiveAtlasOrganization();
  const params = new URLSearchParams({ id: `eq.${file.id}`, org_id: `eq.${organization.id}` });
  const metadata = await authorizedAtlasFetch(`/rest/v1/atlas_drive_files?${params.toString()}`, { method: 'DELETE' });
  if (!metadata.ok) throw new Error(`drive_metadata_delete_failed_${metadata.status}`);
}

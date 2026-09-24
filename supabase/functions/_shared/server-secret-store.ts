type ServerSecretFetch = typeof fetch;

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function restRoot(supabaseUrl: string): string {
  return `${required(supabaseUrl, 'Supabase URL').replace(/\/$/, '')}/rest/v1/rpc`;
}

function serviceHeaders(serviceRoleKey: string): HeadersInit {
  const key = required(serviceRoleKey, 'Supabase service role key');
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    'Content-Type': 'application/json'
  };
}

export async function getServerSecret(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  name: string;
  fetchImpl?: ServerSecretFetch;
}): Promise<string | null> {
  const response = await (input.fetchImpl ?? fetch)(
    `${restRoot(input.supabaseUrl)}/atlas_get_server_secret`,
    {
      method: 'POST',
      headers: serviceHeaders(input.serviceRoleKey),
      body: JSON.stringify({ p_name: required(input.name, 'Secret name') })
    }
  );
  if (!response.ok) throw new Error(`ATLAS server secret read failed (${response.status})`);
  const value = await response.json() as unknown;
  return typeof value === 'string' && value ? value : null;
}

export async function setServerSecret(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  name: string;
  secret: string;
  description?: string | null;
  fetchImpl?: ServerSecretFetch;
}): Promise<void> {
  const response = await (input.fetchImpl ?? fetch)(
    `${restRoot(input.supabaseUrl)}/atlas_set_server_secret`,
    {
      method: 'POST',
      headers: serviceHeaders(input.serviceRoleKey),
      body: JSON.stringify({
        p_name: required(input.name, 'Secret name'),
        p_secret: required(input.secret, 'Secret value'),
        p_description: input.description ?? null
      })
    }
  );
  if (!response.ok) throw new Error(`ATLAS server secret write failed (${response.status})`);
}

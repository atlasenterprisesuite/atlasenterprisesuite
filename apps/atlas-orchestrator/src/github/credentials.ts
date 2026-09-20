import type { GitHubAppCredentials } from './appAuth';

type FetchLike = typeof fetch;

export type GitHubAppStoredCredentials = GitHubAppCredentials & {
  webhookSecret: string;
  clientId: string | null;
  clientSecret: string | null;
};

type Env = Record<string, string | undefined>;

function supabaseAuth(env: Env): { baseUrl: string; headers: Record<string, string> } {
  const baseUrl = String(env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  if (!baseUrl) throw new Error('ATLAS GitHub setup requires SUPABASE_URL');

  const serviceRole = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (serviceRole) {
    return {
      baseUrl,
      headers: {
        apikey: serviceRole,
        authorization: `Bearer ${serviceRole}`,
        'content-type': 'application/json',
      },
    };
  }

  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const runtimeToken = String(env.ATLAS_ORCHESTRATOR_PERSISTENCE_TOKEN || '').trim();
  if (!publishableKey || !runtimeToken) {
    throw new Error('ATLAS GitHub setup requires durable Supabase runtime credentials');
  }
  return {
    baseUrl,
    headers: {
      apikey: publishableKey,
      'content-type': 'application/json',
      'x-atlas-runtime-token': runtimeToken,
    },
  };
}

async function rpc<T>(
  env: Env,
  name: string,
  body: Record<string, unknown>,
  fetchImpl: FetchLike,
): Promise<T> {
  const auth = supabaseAuth(env);
  const response = await fetchImpl(`${auth.baseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: auth.headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`ATLAS GitHub credential RPC failed with HTTP ${response.status}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function storeGitHubAppCredentials(input: {
  env: Env;
  credentials: GitHubAppStoredCredentials;
  fetchImpl?: FetchLike;
}): Promise<void> {
  await rpc(input.env, 'atlas_orchestrator_store_github_app_credentials', {
    p_app_id: input.credentials.appId,
    p_private_key: input.credentials.privateKey,
    p_webhook_secret: input.credentials.webhookSecret,
    p_client_id: input.credentials.clientId,
    p_client_secret: input.credentials.clientSecret,
  }, input.fetchImpl ?? fetch);
}

export async function loadGitHubAppCredentials(input: {
  env: Env;
  fetchImpl?: FetchLike;
}): Promise<GitHubAppStoredCredentials | null> {
  const value = await rpc<{
    app_id?: string;
    private_key?: string;
    webhook_secret?: string;
    client_id?: string | null;
    client_secret?: string | null;
  } | null>(input.env, 'atlas_orchestrator_get_github_app_credentials', {}, input.fetchImpl ?? fetch);

  if (!value?.app_id || !value.private_key || !value.webhook_secret) return null;
  return {
    appId: value.app_id,
    privateKey: value.private_key,
    webhookSecret: value.webhook_secret,
    clientId: value.client_id ?? null,
    clientSecret: value.client_secret ?? null,
  };
}

export async function storeGitHubInstallation(input: {
  env: Env;
  installationId: number;
  repository: string;
  fetchImpl?: FetchLike;
}): Promise<void> {
  await rpc(input.env, 'atlas_orchestrator_store_github_installation', {
    p_installation_id: input.installationId,
    p_repository_full_name: input.repository,
  }, input.fetchImpl ?? fetch);
}

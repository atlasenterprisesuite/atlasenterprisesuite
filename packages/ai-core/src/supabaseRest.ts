export type AtlasFetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

export type AtlasFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<AtlasFetchResponse>;

export interface SupabaseRestConfig {
  url: string;
  serviceRoleKey: string;
  fetchImpl?: AtlasFetch;
}

export class SupabaseRestClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: AtlasFetch;

  constructor(private readonly config: SupabaseRestConfig) {
    if (!config.url) throw new Error('ATLAS Supabase URL is required');
    if (!config.serviceRoleKey) throw new Error('ATLAS Supabase service role key is required');
    this.baseUrl = config.url.replace(/\/$/, '');
    const runtimeFetch = config.fetchImpl ?? (globalThis.fetch as unknown as AtlasFetch | undefined);
    if (!runtimeFetch) throw new Error('ATLAS fetch implementation is required');
    this.fetchImpl = runtimeFetch;
  }

  async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      prefer?: string;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      apikey: this.config.serviceRoleKey,
      authorization: `Bearer ${this.config.serviceRoleKey}`,
      accept: 'application/json',
    };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.prefer) headers.prefer = options.prefer;

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`ATLAS Supabase request failed (${response.status})`);
    }
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
}

export function eq(value: string): string {
  return `eq.${encodeURIComponent(value)}`;
}

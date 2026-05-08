import { Inject, Injectable } from '@nestjs/common';
import { Buffer } from 'node:buffer';
import { JiraConfig, InjectConfig } from '#config';
import { JIRA_FETCH, type JiraFetch } from '#jira-context/providers';
import { JiraError, jiraErrorCodes } from '#jira-context/domain';

export interface JiraRequestOptions {
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly retryOnRateLimit?: boolean;
}

@Injectable()
export class JiraHttpClientService {
  constructor(
    @InjectConfig(JiraConfig) private readonly config: JiraConfig,
    @Inject(JIRA_FETCH) private readonly jiraFetch: JiraFetch,
  ) {}

  async get<T>(path: string, options: JiraRequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  async getPage<TItem>(path: string, valueKey: 'values' | 'issues', options: JiraRequestOptions = {}): Promise<readonly TItem[]> {
    const items: TItem[] = [];
    let startAt = 0;
    let isLast = false;

    while (!isLast) {
      const page = await this.get<JiraPage<TItem>>(path, {
        ...options,
        query: { ...options.query, startAt, maxResults: 50 },
      });
      items.push(...(page[valueKey] ?? []));
      const maxResults = page.maxResults ?? 50;
      startAt = (page.startAt ?? startAt) + maxResults;
      isLast = page.isLast ?? startAt >= (page.total ?? items.length);
    }

    return items;
  }

  private async request<T>(method: string, path: string, body: unknown, options: JiraRequestOptions): Promise<T> {
    if (!this.config.configured || !this.config.apiBaseUrl || !this.config.email || !this.config.apiToken) {
      throw new JiraError('Jira is not configured.', jiraErrorCodes.notConfigured);
    }

    const response = await this.send(method, path, body, options);
    if (response.status === 429 && options.retryOnRateLimit !== false) {
      const retryAfterMs = Number.parseInt(response.headers.get('retry-after') ?? '1', 10) * 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfterMs, 1000)));
      const retryResponse = await this.send(method, path, body, { ...options, retryOnRateLimit: false });
      return parseResponse<T>(retryResponse);
    }

    return parseResponse<T>(response);
  }

  private async send(method: string, path: string, body: unknown, options: JiraRequestOptions): Promise<Response> {
    const url = new URL(`${this.config.apiBaseUrl}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`, 'utf8').toString('base64');
    return this.jiraFetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
}

interface JiraPage<TItem> {
  readonly startAt?: number;
  readonly maxResults?: number;
  readonly total?: number;
  readonly isLast?: boolean;
  readonly values?: readonly TItem[];
  readonly issues?: readonly TItem[];
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  const body = await response.text().catch(() => '');
  const message = `Jira request failed with ${response.status}${body ? `: ${body}` : ''}`;

  if (response.status === 401) throw new JiraError(message, jiraErrorCodes.authFailed);
  if (response.status === 403) throw new JiraError(message, jiraErrorCodes.forbidden);
  if (response.status === 404) throw new JiraError(message, jiraErrorCodes.notFound);
  if (response.status === 429) throw new JiraError(message, jiraErrorCodes.rateLimited);

  throw new JiraError(message, jiraErrorCodes.requestFailed);
}

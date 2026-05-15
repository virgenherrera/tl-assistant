import { Inject, Injectable } from '@nestjs/common';
import { Buffer } from 'node:buffer';
import { ConfluenceConfig, InjectConfig } from '#config';
import { CONFLUENCE_FETCH, type ConfluenceFetch } from '#confluence-context/providers';
import { ConfluenceError, confluenceErrorCodes } from '#confluence-context/domain';

export interface ConfluenceRequestOptions {
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly retryOnRateLimit?: boolean;
}

@Injectable()
export class ConfluenceHttpClientService {
  constructor(
    @InjectConfig(ConfluenceConfig) private readonly config: ConfluenceConfig,
    @Inject(CONFLUENCE_FETCH) private readonly confluenceFetch: ConfluenceFetch,
  ) {}

  async get<T>(path: string, options: ConfluenceRequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  private async request<T>(method: string, path: string, body: unknown, options: ConfluenceRequestOptions): Promise<T> {
    if (!this.config.configured || !this.config.apiBaseUrl || !this.config.email || !this.config.apiToken) {
      throw new ConfluenceError('Confluence is not configured.', confluenceErrorCodes.notConfigured);
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

  private async send(method: string, path: string, body: unknown, options: ConfluenceRequestOptions): Promise<Response> {
    const url = new URL(`${this.config.apiBaseUrl}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`, 'utf8').toString('base64');
    return this.confluenceFetch(url, {
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

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  const body = await response.text().catch(() => '');
  const message = `Confluence request failed with ${response.status}${body ? `: ${body}` : ''}`;

  if (response.status === 401) throw new ConfluenceError(message, confluenceErrorCodes.authFailed);
  if (response.status === 403) throw new ConfluenceError(message, confluenceErrorCodes.forbidden);
  if (response.status === 404) throw new ConfluenceError(message, confluenceErrorCodes.notFound);
  if (response.status === 429) throw new ConfluenceError(message, confluenceErrorCodes.rateLimited);

  throw new ConfluenceError(message, confluenceErrorCodes.requestFailed);
}

import { Inject, Injectable } from '@nestjs/common';
import { ConfluenceConfig, InjectConfig } from '#config';
import { AgentCapabilityRegistry } from '#capabilities';
import { ConfluenceHttpClientService } from '#confluence-context/adapters';
import type { ConfluenceConnectionSnapshot, ConfluencePageDetail, ConfluenceSearchResult, ConfluenceSearchResultItem } from '#confluence-context/domain';
import { ConfluenceError, confluenceErrorCodes } from '#confluence-context/domain';

@Injectable()
export class ConfluenceReaderService {
  constructor(
    @InjectConfig(ConfluenceConfig) private readonly config: ConfluenceConfig,
    @Inject(ConfluenceHttpClientService) private readonly httpClient: ConfluenceHttpClientService,
    @Inject(AgentCapabilityRegistry) private readonly capabilityRegistry: AgentCapabilityRegistry,
  ) {}

  async handshake(): Promise<ConfluenceConnectionSnapshot> {
    if (!this.config.configured || !this.config.siteUrl || !this.config.apiBaseUrl) {
      throw new ConfluenceError('Confluence is not configured.', confluenceErrorCodes.notConfigured);
    }

    try {
      const user = await this.httpClient.get<ConfluenceCurrentUserResponse>('/rest/api/user/current');
      const snapshot: ConfluenceConnectionSnapshot = {
        schemaVersion: 'tl-assistant.confluence.connection.v1',
        generatedAt: new Date().toISOString(),
        siteUrl: this.config.siteUrl,
        apiBaseUrl: this.config.apiBaseUrl,
        capability: 'confluence.read',
        status: 'available',
        currentUser: {
          ...(user.accountId === undefined ? {} : { accountId: user.accountId }),
          ...(user.displayName === undefined ? {} : { displayName: user.displayName }),
          ...(user.email === undefined ? {} : { email: user.email }),
        },
      };
      this.capabilityRegistry.markAvailable('confluence.read', [this.config.siteUrl]);
      return snapshot;
    } catch (error) {
      this.capabilityRegistry.markDegraded('confluence.read');
      throw error;
    }
  }

  async getPage(pageId: string): Promise<ConfluencePageDetail> {
    const page = await this.httpClient.get<ConfluencePageResponse>(`/api/v2/pages/${encodeURIComponent(pageId)}`, {
      query: { 'body-format': 'storage' },
    });

    const storage = page.body?.storage?.value ?? '';
    const bodyText = htmlToText(storage);
    const webUrl = this.resolveWebUrl(page._links?.webui);

    return {
      id: page.id,
      ref: `foundation://confluence/${page.spaceId ?? 'unknown'}/${page.id}`,
      title: page.title,
      ...(page.status === undefined ? {} : { status: page.status }),
      ...(page.spaceId === undefined ? {} : { spaceId: page.spaceId }),
      ...(page.version?.number === undefined ? {} : { version: page.version.number }),
      ...(webUrl === undefined ? {} : { webUrl }),
      bodyText,
      ...(storage === '' ? {} : { bodyStorage: storage }),
    };
  }

  async search(query: string, limit = 10): Promise<ConfluenceSearchResult> {
    const cql = this.buildCql(query);
    const result = await this.httpClient.get<ConfluenceSearchResponse>('/rest/api/search', {
      query: { cql, limit: Math.max(1, Math.min(limit, 25)) },
    });

    return {
      schemaVersion: 'tl-assistant.confluence.search.v1',
      generatedAt: new Date().toISOString(),
      query,
      cql,
      results: (result.results ?? []).map((item): ConfluenceSearchResultItem => {
        const content = item.content;
        const id = content?.id;
        const webUrl = this.resolveWebUrl(item.url ?? content?._links?.webui);
        return {
          ...(id === undefined ? {} : { id, ref: `foundation://confluence/${content?.space?.key ?? 'unknown'}/${id}` }),
          title: content?.title ?? item.title ?? '(Sin título)',
          ...(item.excerpt === undefined ? {} : { excerpt: htmlToText(item.excerpt) }),
          ...(webUrl === undefined ? {} : { url: webUrl }),
          ...(content?.type === undefined ? {} : { type: content.type }),
          ...(content?.space?.key === undefined ? {} : { spaceKey: content.space.key }),
        };
      }),
    };
  }

  private buildCql(query: string): string {
    const escapedQuery = query.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const spaceClause = this.config.spaceKey ? ` AND space = "${this.config.spaceKey.replace(/"/g, '\\"')}"` : '';
    return `type = page AND text ~ "${escapedQuery}"${spaceClause} ORDER BY lastmodified DESC`;
  }

  private resolveWebUrl(pathOrUrl?: string): string | undefined {
    if (!pathOrUrl || !this.config.siteUrl) return undefined;
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return `${this.config.siteUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
  }
}

interface ConfluenceCurrentUserResponse {
  readonly accountId?: string;
  readonly displayName?: string;
  readonly email?: string;
}

interface ConfluencePageResponse {
  readonly id: string;
  readonly status?: string;
  readonly title: string;
  readonly spaceId?: string;
  readonly body?: {
    readonly storage?: {
      readonly value?: string;
      readonly representation?: string;
    };
  };
  readonly version?: { readonly number?: number };
  readonly _links?: { readonly webui?: string };
}

interface ConfluenceSearchResponse {
  readonly results?: readonly ConfluenceSearchItemResponse[];
}

interface ConfluenceSearchItemResponse {
  readonly title?: string;
  readonly excerpt?: string;
  readonly url?: string;
  readonly content?: {
    readonly id?: string;
    readonly type?: string;
    readonly title?: string;
    readonly space?: { readonly key?: string };
    readonly _links?: { readonly webui?: string };
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

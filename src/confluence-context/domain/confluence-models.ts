export interface ConfluenceConnectionSnapshot {
  readonly schemaVersion: 'tl-assistant.confluence.connection.v1';
  readonly generatedAt: string;
  readonly siteUrl: string;
  readonly apiBaseUrl: string;
  readonly capability: 'confluence.read';
  readonly status: 'available';
  readonly currentUser?: ConfluenceUserBrief;
}

export interface ConfluenceUserBrief {
  readonly accountId?: string;
  readonly displayName?: string;
  readonly email?: string;
}

export interface ConfluencePageDetail {
  readonly id: string;
  readonly ref: string;
  readonly title: string;
  readonly status?: string;
  readonly spaceId?: string;
  readonly version?: number;
  readonly webUrl?: string;
  readonly bodyText: string;
  readonly bodyStorage?: string;
}

export interface ConfluenceSearchResultItem {
  readonly id?: string;
  readonly ref?: string;
  readonly title: string;
  readonly excerpt?: string;
  readonly url?: string;
  readonly type?: string;
  readonly spaceKey?: string;
}

export interface ConfluenceSearchResult {
  readonly schemaVersion: 'tl-assistant.confluence.search.v1';
  readonly generatedAt: string;
  readonly query: string;
  readonly cql: string;
  readonly results: readonly ConfluenceSearchResultItem[];
}

import type { Observable } from 'rxjs';

export interface FoundationDocSource {
  readonly path: string;
  readonly extension: string;
  readonly size?: number;
  readonly mtimeMs?: number;
}

export interface FoundationDocReaderPort {
  discoverSources(rootPath: string): Promise<readonly FoundationDocSource[]>;
  discoverSources$(rootPath: string): Observable<FoundationDocSource>;
}

import type { Observable } from 'rxjs';

export type FoundationSourceKind = 'local' | 'confluence';

export interface FoundationSource {
  readonly kind: FoundationSourceKind;
  readonly path: string;
  readonly extension: string;
  readonly size?: number;
  readonly mtimeMs?: number;
}

export interface FoundationSourceReader {
  readonly sourceKind: FoundationSourceKind;
  discoverSources(rootPath: string): Promise<readonly FoundationSource[]>;
  discoverSources$(rootPath: string): Observable<FoundationSource>;
}

import type { DogmaBriefItemKind, DogmaRefreshResult } from '#domain/dogma';
import type { FoundationDocSource } from '#ports';

export interface DogmaRefreshStats {
  readonly discovered: number;
  readonly processed: number;
  readonly skipped: number;
  readonly failed: number;
  readonly briefItems: number;
  readonly durationMs: number;
}

export type DogmaRefreshEvent =
  | { readonly type: 'discovery.started'; readonly rootPaths: readonly string[] }
  | { readonly type: 'source.discovered'; readonly source: FoundationDocSource; readonly discovered: number }
  | { readonly type: 'source.read.started'; readonly source: FoundationDocSource }
  | { readonly type: 'source.read.progress'; readonly source: FoundationDocSource; readonly bytesRead: number; readonly totalBytes?: number }
  | { readonly type: 'source.extracted'; readonly source: FoundationDocSource; readonly characters: number }
  | { readonly type: 'source.skipped'; readonly source: FoundationDocSource; readonly reason: string }
  | { readonly type: 'source.failed'; readonly source: FoundationDocSource; readonly error: string }
  | {
    readonly type: 'dogma.brief-item.created';
    readonly source: FoundationDocSource;
    readonly item: {
      readonly id: string;
      readonly kind: DogmaBriefItemKind;
      readonly title: string;
      readonly sourceRefs: readonly string[];
    };
  }
  | { readonly type: 'refresh.completed'; readonly result: DogmaRefreshResult; readonly stats: DogmaRefreshStats };

export type DocumentExtractionEvent =
  | { readonly type: 'read.started'; readonly source: FoundationDocSource }
  | { readonly type: 'read.progress'; readonly source: FoundationDocSource; readonly bytesRead: number; readonly totalBytes?: number }
  | { readonly type: 'extracted'; readonly source: FoundationDocSource; readonly text: string }
  | { readonly type: 'skipped'; readonly source: FoundationDocSource; readonly reason: string };

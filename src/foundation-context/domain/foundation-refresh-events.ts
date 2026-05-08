import type { FoundationBriefItemKind, FoundationRefreshResult } from '#domain/foundation';
import type { FoundationSource } from '#ports';

export interface FoundationRefreshStats {
  readonly discovered: number;
  readonly processed: number;
  readonly skipped: number;
  readonly failed: number;
  readonly briefItems: number;
  readonly durationMs: number;
}

export type FoundationRefreshEvent =
  | { readonly type: 'discovery.started'; readonly rootPaths: readonly string[] }
  | { readonly type: 'source.discovered'; readonly source: FoundationSource; readonly discovered: number }
  | { readonly type: 'source.read.started'; readonly source: FoundationSource }
  | { readonly type: 'source.read.progress'; readonly source: FoundationSource; readonly bytesRead: number; readonly totalBytes?: number }
  | { readonly type: 'source.extracted'; readonly source: FoundationSource; readonly characters: number }
  | { readonly type: 'source.skipped'; readonly source: FoundationSource; readonly reason: string }
  | { readonly type: 'source.failed'; readonly source: FoundationSource; readonly error: string }
  | {
    readonly type: 'foundation.brief-item.created';
    readonly source: FoundationSource;
    readonly item: {
      readonly id: string;
      readonly kind: FoundationBriefItemKind;
      readonly title: string;
      readonly sourceRefs: readonly string[];
    };
  }
  | { readonly type: 'refresh.completed'; readonly result: FoundationRefreshResult; readonly stats: FoundationRefreshStats };

export type DocumentExtractionEvent =
  | { readonly type: 'read.started'; readonly source: FoundationSource }
  | { readonly type: 'read.progress'; readonly source: FoundationSource; readonly bytesRead: number; readonly totalBytes?: number }
  | { readonly type: 'extracted'; readonly source: FoundationSource; readonly text: string }
  | { readonly type: 'skipped'; readonly source: FoundationSource; readonly reason: string };

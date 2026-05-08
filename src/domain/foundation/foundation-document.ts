import type { UniversalAgentContext } from './agent-context';

export type FoundationSourceStatus = 'extracted' | 'skipped' | 'failed';
export type FoundationBriefItemKind = 'principle' | 'constraint' | 'risk' | 'decision' | 'glossary' | 'open-question';

export type FoundationSourceKind = 'local' | 'confluence';

export interface FoundationSourceEntry {
  readonly kind: FoundationSourceKind;
  readonly ref: string;
  readonly relativePath: string;
  readonly extension: string;
  readonly size?: number;
  readonly mtimeMs?: number;
  readonly status: FoundationSourceStatus;
  readonly error?: string;
}

export interface FoundationSourceMap {
  readonly schemaVersion: 'tl-assistant.foundation-source-map.v1';
  readonly generatedAt: string;
  readonly sourceRefs: readonly ('foundation.local' | 'foundation.confluence')[];
  readonly sources: readonly FoundationSourceEntry[];
}

export interface FoundationExtraction {
  readonly sourceRef: string;
  readonly relativePath: string;
  readonly text: string;
  readonly characters: number;
}

export interface FoundationBriefItem {
  readonly id: string;
  readonly kind: FoundationBriefItemKind;
  readonly title: string;
  readonly summary: string;
  readonly sourceRefs: readonly string[];
}

export interface FoundationBrief {
  readonly schemaVersion: 'tl-assistant.foundation-brief.v1';
  readonly generatedAt: string;
  readonly summary: string;
  readonly items: readonly FoundationBriefItem[];
}

export interface FoundationRefreshResult {
  readonly generatedAt: string;
  readonly sourceMap: FoundationSourceMap;
  readonly extractions: readonly FoundationExtraction[];
  readonly brief: FoundationBrief;
  readonly agentContext: UniversalAgentContext;
  readonly outputFiles: readonly string[];
}

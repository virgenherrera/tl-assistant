import type { UniversalAgentContext } from './agent-context';

export type DogmaSourceStatus = 'extracted' | 'skipped' | 'failed';
export type DogmaBriefItemKind = 'principle' | 'constraint' | 'risk' | 'decision' | 'glossary' | 'open-question';

export interface DogmaSourceEntry {
  readonly ref: string;
  readonly relativePath: string;
  readonly extension: string;
  readonly size?: number;
  readonly mtimeMs?: number;
  readonly status: DogmaSourceStatus;
  readonly error?: string;
}

export interface DogmaSourceMap {
  readonly schemaVersion: 'tl-assistant.source-map.v1';
  readonly generatedAt: string;
  readonly sourceRootRef: 'FOUNDATION_DOCS_PATH';
  readonly sources: readonly DogmaSourceEntry[];
}

export interface DogmaExtraction {
  readonly sourceRef: string;
  readonly relativePath: string;
  readonly text: string;
  readonly characters: number;
}

export interface DogmaBriefItem {
  readonly id: string;
  readonly kind: DogmaBriefItemKind;
  readonly title: string;
  readonly summary: string;
  readonly sourceRefs: readonly string[];
}

export interface DogmaBrief {
  readonly schemaVersion: 'tl-assistant.dogma-brief.v1';
  readonly generatedAt: string;
  readonly summary: string;
  readonly items: readonly DogmaBriefItem[];
}

export interface DogmaRefreshResult {
  readonly generatedAt: string;
  readonly sourceMap: DogmaSourceMap;
  readonly extractions: readonly DogmaExtraction[];
  readonly brief: DogmaBrief;
  readonly agentContext: UniversalAgentContext;
  readonly outputFiles: readonly string[];
}

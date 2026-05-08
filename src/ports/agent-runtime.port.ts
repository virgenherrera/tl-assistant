import type { FoundationBriefItem } from '#domain/foundation';

export interface AgentReadRequest {
  readonly sourceRef: string;
  readonly relativePath: string;
  readonly rawContent: string;
}

export interface AgentReadResult {
  readonly items: readonly FoundationBriefItem[];
  readonly summary: string;
}

export interface AgentRuntimePort {
  readonly name: string;
  readForFoundation(request: AgentReadRequest): Promise<AgentReadResult>;
}

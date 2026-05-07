import type { DogmaBriefItem } from '#domain/dogma';

export interface AgentReadRequest {
  readonly sourceRef: string;
  readonly relativePath: string;
  readonly rawContent: string;
}

export interface AgentReadResult {
  readonly items: readonly DogmaBriefItem[];
  readonly summary: string;
}

export interface AgentRuntimePort {
  readonly name: string;
  readForDogma(request: AgentReadRequest): Promise<AgentReadResult>;
}

import type { UniversalAgentContext } from '#domain/foundation';

export interface AgentContextFactoryPort {
  create(input: { readonly generatedAt: string }): UniversalAgentContext;
}

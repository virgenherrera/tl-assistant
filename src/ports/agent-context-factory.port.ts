import type { UniversalAgentContext } from '#domain/dogma';

export interface AgentContextFactoryPort {
  create(input: { readonly generatedAt: string }): UniversalAgentContext;
}

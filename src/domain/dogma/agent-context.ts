export interface AgentContextPersona {
  readonly id: string;
  readonly name: string;
  readonly style: string;
  readonly directives: readonly string[];
}

export interface UniversalAgentContext {
  readonly schemaVersion: 'tl-assistant.agent-context.v2';
  readonly generatedAt: string;
  readonly persona: AgentContextPersona;
  readonly compatibility: {
    readonly format: 'bootstrap-markdown-and-json';
    readonly target: 'any-agent';
    readonly instructions: readonly string[];
  };
  readonly sourceMapRef: 'source-map.json';
  readonly dogmaBriefRef: 'dogma-brief.md';
}

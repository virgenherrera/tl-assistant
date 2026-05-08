import { Injectable } from '@nestjs/common';
import type { UniversalAgentContext } from '#domain/foundation';
import type { AgentContextFactoryPort } from '#ports';
import { masterPersonaDirectives } from '#foundation-context/persona';

@Injectable()
export class UniversalAgentContextFactoryService implements AgentContextFactoryPort {
  create(input: { readonly generatedAt: string }): UniversalAgentContext {
    return {
      schemaVersion: 'tl-assistant.agent-context.v2',
      generatedAt: input.generatedAt,
      persona: masterPersonaDirectives,
      compatibility: {
        format: 'bootstrap-markdown-and-json',
        target: 'any-agent',
        instructions: [
          'Leer foundation-brief.md primero: contiene el brief semántico accionable y referencias foundation://local/... o foundation://confluence/....',
          'Usar source-map.json para ubicar fuentes por ref sin exponer full paths locales.',
          'Usar extractions.json sólo en entorno local confiable cuando el brief no alcance.',
          'No pegar contenido crudo de foundation docs en outputs externos.',
          'Mantener español neutral por defecto salvo instrucción explícita de otro idioma.',
        ],
      },
      sourceMapRef: 'source-map.json',
      foundationBriefRef: 'foundation-brief.md',
    };
  }
}
